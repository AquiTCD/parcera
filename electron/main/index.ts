import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import yaml from 'js-yaml';
import { fileURLToPath } from 'node:url';
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

function loadSettings(): ParceraSettings {
  if (cachedSettings) return cachedSettings;
  try {
    const settingsPath = path.resolve(process.env['APP_ROOT']!, '../configs/settings.yaml');
    if (!fs.existsSync(settingsPath)) {
      console.warn('Settings file not found at:', settingsPath);
      return {};
    }
    const file = fs.readFileSync(settingsPath, 'utf8');
    cachedSettings = yaml.load(file) as ParceraSettings;
    return cachedSettings;
  } catch (e) {
    console.error('Failed to load settings:', e);
    return {};
  }
}

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
