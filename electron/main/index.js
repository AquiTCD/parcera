import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import yaml from 'js-yaml';
import { fileURLToPath } from 'node:url';

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

process.env.APP_ROOT = path.join(__dirname, '..');

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron');
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST;

let userWindow = null;
let aiWindow = null;

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  app.quit();
});

let cachedSettings = null;

function loadSettings() {
  if (cachedSettings) return cachedSettings;
  try {
    const settingsPath = path.resolve(process.env.APP_ROOT, '../configs/settings.yaml');
    if (!fs.existsSync(settingsPath)) {
      console.warn('Settings file not found at:', settingsPath);
      return {};
    }
    const file = fs.readFileSync(settingsPath, 'utf8');
    cachedSettings = yaml.load(file);
    return cachedSettings;
  } catch (e) {
    console.error('Failed to load settings:', e);
    return {};
  }
}

function createAvatarWindow(type) {
  const settings = loadSettings();
  const winCfg = settings?.electron?.windows?.[type] || { width: 400, height: 400, alwaysOnTop: type === 'ai' };

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
    },
  });

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

ipcMain.on('resize-window', (event, width, height) => {
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
