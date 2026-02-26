import { app, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import yaml from 'js-yaml';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Store from 'electron-store';
import type { ParceraSettings, WindowConfig } from '../shared/types';
import { PythonSidecar } from './sidecar';

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

// Separate dev and production data directories to avoid config conflicts.
// Must be called before 'ready' event.
if (!app.isPackaged) {
  app.setPath('userData', path.join(app.getPath('appData'), 'Parcera-Dev'));
}

// Avoids needing a user click to start AudioContext/Media
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows', 'true');

export const VITE_DEV_SERVER_URL: string | undefined = process.env['VITE_DEV_SERVER_URL'];
export const RENDERER_DIST: string = path.join(process.env['APP_ROOT']!, 'dist');

let userWindow: BrowserWindow | null = null;
let aiWindow: BrowserWindow | null = null;
let sidecar: PythonSidecar | null = null;

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

// Apply GPU acceleration setting before app is ready
const gpuEnabled = store.get('electron.gpu_acceleration') ?? true;
if (!gpuEnabled) {
  console.log('[Parcera] Hardware acceleration disabled by user setting.');
  app.disableHardwareAcceleration();
}

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

  // Apply window bounds and alwaysOnTop dynamically
  const applyConfig = (win: BrowserWindow | null, type: 'user' | 'ai') => {
    if (!win || win.isDestroyed()) return;
    const cfg = settings.electron?.windows?.[type];
    if (!cfg) return;

    if (cfg.alwaysOnTop !== undefined) win.setAlwaysOnTop(cfg.alwaysOnTop);

    // Apply bounds only if values are provided
    const bounds: Partial<Electron.Rectangle> = {};
    if (cfg.x !== undefined) bounds.x = Math.round(cfg.x);
    if (cfg.y !== undefined) bounds.y = Math.round(cfg.y);
    if (cfg.width !== undefined) bounds.width = Math.round(cfg.width);
    if (cfg.height !== undefined) bounds.height = Math.round(cfg.height);

    if (Object.keys(bounds).length > 0) {
      const current = win.getBounds();
      win.setBounds({ ...current, ...bounds });
    }
  };

  applyConfig(userWindow, 'user');
  applyConfig(aiWindow, 'ai');
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
    x: winCfg.x,
    y: winCfg.y,
    title: type === 'ai' ? 'Parcera - AI' : 'Parcera - User',
    alwaysOnTop: winCfg.alwaysOnTop,
    transparent: true,
    frame: false,
    hasShadow: false,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false, // Allow preload full access
      contextIsolation: true, // Default, but explicit
      backgroundThrottling: false,
      // @ts-ignore
      disableOcclusionTracking: true,
    },
  });

  // win.webContents.openDevTools({ mode: 'detach' });

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

ipcMain.on('set-resizable', (event, resizable: boolean) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    win.setResizable(resizable);
  }
});

ipcMain.on('close-window', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    win.close();
  }
});

ipcMain.handle('save-window-bounds', async (event, type: string) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return { success: false, error: 'Window not found' };

  try {
    const bounds = win.getBounds();
    const currentSettings = loadSettings();
    const typeKey = type as 'user' | 'ai';

    // Ensure the structure exists
    if (!currentSettings.electron) currentSettings.electron = {};
    if (!currentSettings.electron.windows) currentSettings.electron.windows = {};
    if (!currentSettings.electron.windows[typeKey]) currentSettings.electron.windows[typeKey] = {};

    currentSettings.electron.windows[typeKey].x = Math.round(bounds.x);
    currentSettings.electron.windows[typeKey].y = Math.round(bounds.y);
    currentSettings.electron.windows[typeKey].width = Math.round(bounds.width);
    currentSettings.electron.windows[typeKey].height = Math.round(bounds.height);

    // Save to store
    store.store = currentSettings;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-window-bounds', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return null;
  return win.getBounds();
});

ipcMain.handle('get-avatar-window-bounds', async (_event, type: 'user' | 'ai') => {
  const win = type === 'user' ? userWindow : aiWindow;
  if (!win || win.isDestroyed()) return null;
  return win.getBounds();
});

protocol.registerSchemesAsPrivileged([
  { scheme: 'parcera-asset', privileges: { secure: true, standard: true, supportFetchAPI: true, corsEnabled: true } }
]);

app.whenReady().then(() => {
  // Register protocol to handle local file access
  protocol.handle('parcera-asset', async (request) => {
    try {
      // We want to extract the path accurately.
      // request.url is "parcera-asset://host/pathname"
      // URL objects lowercase the host. Let's use a regex on the original URL to preserve case.
      const match = request.url.match(/^parcera-asset:\/\/+(.*)$/i);
      if (!match) return new Response('Bad Request', { status: 400 });

      let filePath = decodeURIComponent(match[1]);

      // Ensure absolute path on Mac/Linux (starts with /)
      if (!filePath.startsWith('/') && process.platform !== 'win32') {
        filePath = '/' + filePath;
      }

      // On Windows, if it's "/C:/...", strip the leading slash
      if (process.platform === 'win32' && filePath.startsWith('/') && filePath.includes(':')) {
        filePath = filePath.slice(1);
      }

      // console.log('[Parcera] Protocol attempting to serve:', filePath);

      if (!fs.existsSync(filePath)) {
        // console.warn('[Parcera] File not found by protocol:', filePath);
        return new Response('Not Found', { status: 404 });
      }

      const buffer = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
      };

      return new Response(buffer, {
        headers: {
          'Content-Type': mimeTypes[ext] || 'application/octet-stream',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (e) {
      console.error('[Parcera] Protocol error:', e);
      return new Response('Internal Server Error', { status: 500 });
    }
  });

  userWindow = createAvatarWindow('user');
  aiWindow = createAvatarWindow('ai');

  // Initialize sidecar
  const settings = loadSettings();
  sidecar = new PythonSidecar(store.path, settings.electron?.port || 8676, (source, text) => {
    const logMsg = {
      source,
      text,
      timestamp: new Date().toLocaleTimeString(),
    };
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('sidecar-log', logMsg);
    });
  });
  sidecar.start().catch((err) => {
    console.error('[Parcera] Failed to start Python sidecar:', err);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      userWindow = createAvatarWindow('user');
      aiWindow = createAvatarWindow('ai');
    }
  });
});

app.on('window-all-closed', () => {
  // Parcera should fully quit when all windows are closed (including macOS).
  // The sidecar is stopped here AND in before-quit as a safety net.
  if (sidecar) {
    sidecar.stop();
  }
  app.quit();
});

app.on('before-quit', () => {
  // Double-ensure cleanup for cases like Cmd+Q or force quit
  if (sidecar) {
    sidecar.stop();
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
    width: 600,
    height: 800,
    title: 'Parcera Settings',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false,
      contextIsolation: true,
    },
  });

  // win.webContents.openDevTools({ mode: 'detach' });

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

    // Notify Python server to reload config immediately
    const port = newSettings.electron?.port || 8676;
    const url = `http://127.0.0.1:${port}/config/reload`;

    // Fire and forget, or wait briefly. Main process doesn't want to hang.
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSettings)
    }).catch(e => console.warn('[Parcera] Python reload notification failed (likely server not running):', e.message));

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
