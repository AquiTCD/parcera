import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import yaml from 'js-yaml';
import { fileURLToPath } from 'node:url';
import Store from 'electron-store';
import type { ParceraSettings, WindowConfig } from '../shared/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Main-process
// │ └─┬ preload
// │   └── index.js    > Preload-scripts
// ├─┬ dist
// │ └── index.html    > Renderer-process
//

process.env['APP_ROOT'] = path.join(__dirname, '..');

export const VITE_DEV_SERVER_URL: string | undefined = process.env['VITE_DEV_SERVER_URL'];
export const RENDERER_DIST: string = path.join(process.env['APP_ROOT']!, 'dist');

let userWindow: BrowserWindow | null = null;
let aiWindow: BrowserWindow | null = null;

process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught Exception:', error);
  app.quit();
});

let cachedSettings: ParceraSettings | null = null;
const store = new Store<ParceraSettings>({ name: 'config' });

function getYamlSettingsPath(): string {
  return path.resolve(process.env['APP_ROOT']!, '../configs/settings.default.yaml');
}

function initializeStore() {
  if (Object.keys(store.store).length === 0) {
    console.log('[Parcera] Store is empty, seeding from configs/settings.default.yaml...');
    try {
      const settingsPath = getYamlSettingsPath();
      if (fs.existsSync(settingsPath)) {
        const file = fs.readFileSync(settingsPath, 'utf8');
        const yamlSettings = yaml.load(file) as ParceraSettings;
        store.store = yamlSettings;
      }
    } catch (e) {
      console.error('Failed to seed store from YAML:', e);
    }
  }
}

initializeStore();
console.log('[Parcera] Store path:', store.path);

// Write path to a file so Python dev server can easily find it
try {
  const envPath = path.resolve(process.env['APP_ROOT']!, '../.env.config_path');
  fs.writeFileSync(envPath, `PARCERA_CONFIG_PATH="${store.path}"\n`, 'utf8');
} catch (e) {
  // Ignore
}

function loadSettings(): ParceraSettings {
  return store.store;
}

/** Notify all renderer windows that settings have changed */
function broadcastSettingsReload(): void {
  const settings = loadSettings();
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('settings-changed', settings);
  }

  // Apply alwaysOnTop dynamically
  if (userWindow) {
    userWindow.setAlwaysOnTop(settings.electron?.windows?.user?.alwaysOnTop ?? false);
  }
  if (aiWindow) {
    aiWindow.setAlwaysOnTop(settings.electron?.windows?.ai?.alwaysOnTop ?? false);
  }
}

store.onDidAnyChange((newValue, oldValue) => {
  console.log('[Parcera] Store changed, reloading...');
  broadcastSettingsReload();
});

function createAvatarWindow(type: string): BrowserWindow {
  const settings = loadSettings();
  const winCfg: WindowConfig = settings.electron?.windows?.[type] || { width: 400, height: 400, alwaysOnTop: type === 'ai' };

  const win = new BrowserWindow({
    width: winCfg.width,
    height: winCfg.height,
    alwaysOnTop: winCfg.alwaysOnTop,
    transparent: true,
    frame: false,
    hasShadow: false,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false, // Allow preload full access
      contextIsolation: true, // Default, but explicit
    },
  });

  win.webContents.openDevTools({ mode: 'detach' });

  if (process.platform === 'darwin') {
    win.setWindowButtonVisibility(false);
  }

  const url = VITE_DEV_SERVER_URL
    ? `${VITE_DEV_SERVER_URL}?type=${type}`
    : `file://${path.join(RENDERER_DIST, 'index.html')}?type=${type}`;

  win.loadURL(url);
  return win;
}

ipcMain.handle('get-settings', async () => {
  return loadSettings();
});

ipcMain.handle('reload-settings', async () => {
  return loadSettings();
});

ipcMain.handle('get-default-settings', async () => {
  try {
    const settingsPath = getYamlSettingsPath();
    if (fs.existsSync(settingsPath)) {
      const file = fs.readFileSync(settingsPath, 'utf8');
      return yaml.load(file) as ParceraSettings;
    }
  } catch (e) {
    console.error('Failed to load default settings:', e);
  }
  return {};
});

ipcMain.handle('select-directory', async (event, currentPath: string) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return null;
  const result = await dialog.showOpenDialog(win, {
    defaultPath: currentPath || process.env['APP_ROOT'] || undefined,
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.on('resize-window', (event, width: number, height: number) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    win.setSize(Math.round(width), Math.round(height));
  }
});

app.whenReady().then(() => {
  userWindow = createAvatarWindow('user');
  aiWindow = createAvatarWindow('ai');

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      userWindow = createAvatarWindow('user');
      aiWindow = createAvatarWindow('ai');
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

let settingsWindow: BrowserWindow | null = null;

function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  const settings = loadSettings();
  const win = new BrowserWindow({
    width: 900,
    height: 800,
    title: 'Parcera Settings',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false,
      contextIsolation: true,
    },
  });

  win.webContents.openDevTools({ mode: 'detach' });

  const url = VITE_DEV_SERVER_URL
    ? `${VITE_DEV_SERVER_URL}?type=settings`
    : `file://${path.join(RENDERER_DIST, 'index.html')}?type=settings`;

  win.loadURL(url);

  win.on('closed', () => {
    settingsWindow = null;
  });

  settingsWindow = win;
}

ipcMain.handle('save-settings', async (_event, newSettings: ParceraSettings) => {
  try {
    store.store = newSettings;
    return { success: true };
  } catch (e) {
    console.error('Failed to save settings:', e);
    return { success: false, error: String(e) };
  }
});

import { Menu } from 'electron';

const template: Electron.MenuItemConstructorOptions[] = [
  {
    label: 'Parcera',
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      {
        label: 'Preferences...',
        accelerator: 'CmdOrCtrl+,',
        click: () => {
          createSettingsWindow();
        },
      },
      { type: 'separator' },
      { role: 'quit' },
    ],
  },
  {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      {
        ...(process.platform === 'darwin' ? {
          role: 'pasteAndMatchStyle'
        } : {} as any)
      },
      { role: 'delete' },
      { role: 'selectAll' }
    ]
  }
];

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);
