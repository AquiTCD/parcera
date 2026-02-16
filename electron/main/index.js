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

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  app.quit();
});

function loadSettings() {
  try {
    const settingsPath = path.resolve(process.env.APP_ROOT, '../configs/settings.yaml');
    console.log('Attempting to load settings from:', settingsPath);
    if (!fs.existsSync(settingsPath)) {
      console.warn('Settings file not found at:', settingsPath);
      return {};
    }
    const file = fs.readFileSync(settingsPath, 'utf8');
    return yaml.load(file);
  } catch (e) {
    console.error('Failed to load settings:', e);
    return {};
  }
}

function createUserWindow() {
  const settings = loadSettings();
  const winCfg = settings?.electron?.windows?.user || { width: 400, height: 600, alwaysOnTop: false };

  userWindow = new BrowserWindow({
    width: winCfg.width,
    height: winCfg.height,
    alwaysOnTop: winCfg.alwaysOnTop,
    transparent: true,
    frame: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // macOS specific: make window truly transparent and float
  if (process.platform === 'darwin') {
    userWindow.setWindowButtonVisibility(false);
  }

  if (VITE_DEV_SERVER_URL) {
    userWindow.loadURL(VITE_DEV_SERVER_URL);
  } else {
    userWindow.loadFile(path.join(RENDERER_DIST, 'index.html'));
  }
}

ipcMain.handle('get-settings', async () => {
  return loadSettings();
});

app.whenReady().then(() => {
  createUserWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createUserWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
