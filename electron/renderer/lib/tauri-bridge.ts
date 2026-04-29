import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { LogicalSize } from '@tauri-apps/api/dpi';
import type { ParceraAPI, Rect, LogEntry, OpResult, TwitchStatus, DownloadProgress } from './bridge';
import type { ParceraSettings } from '../../shared/types';

function makeListener<T>(eventName: string, cb: (payload: T) => void): () => void {
  const p = listen<T>(eventName, (event) => cb(event.payload));
  return async () => { (await p)(); };
}

export const api: ParceraAPI = {
  platform: 'tauri',

  // Settings
  getSettings: () => invoke<ParceraSettings>('get_settings'),
  getDefaultSettings: () => invoke<ParceraSettings>('get_default_settings'),
  saveSettings: (settings) => invoke<OpResult>('save_settings', { settings }),
  updateSetting: (key, value) => invoke<OpResult>('update_setting', { key, value }),
  reloadSettings: () => invoke<ParceraSettings>('reload_settings'),
  onSettingsChanged: (cb) => makeListener<ParceraSettings>('settings-changed', cb),

  // Window
  resizeWindow: (width, height) => { getCurrentWindow().setSize(new LogicalSize(width, height)); },
  setResizable: (resizable) => { getCurrentWindow().setResizable(resizable); },
  closeWindow: () => { getCurrentWindow().close(); },
  getWindowBounds: async (): Promise<Rect | null> => {
    const win = getCurrentWindow();
    const [pos, size, scale] = await Promise.all([
      win.outerPosition(),
      win.outerSize(),
      win.scaleFactor(),
    ]);
    return {
      x: pos.x / scale,
      y: pos.y / scale,
      width: size.width / scale,
      height: size.height / scale,
    };
  },
  saveWindowBounds: (type) => invoke<OpResult>('save_window_bounds', { window_type: type }),
  getAvatarWindowBounds: (type) => invoke<Rect>('get_avatar_window_bounds', { window_type: type }),

  // FS / Dialog
  resolveLocalPath: (filePath) => {
    // Bundled web assets (/assets/... or assets/...): strip leading slash and
    // return as a web-relative path served by Vite/dist. Same logic as Electron preload.
    if (filePath.startsWith('assets/') || filePath.startsWith('/assets/')) {
      return filePath.startsWith('/') ? filePath.slice(1) : filePath;
    }
    // Absolute filesystem paths (user data dir, etc.): convert to asset:// URL.
    if (filePath.startsWith('/') || /^[A-Za-z]:\\/.test(filePath)) {
      return convertFileSrc(filePath);
    }
    return filePath;
  },
  selectDirectory: (currentPath?) => invoke<string | null>('select_directory', { current_path: currentPath }),

  // Logs
  getLogHistory: () => invoke<LogEntry[]>('get_log_history'),
  onLogMessage: (cb) => makeListener<LogEntry>('sidecar-log', cb),

  // Models — HTTP direct to Python backend; no Tauri commands needed
  checkModelCached: async (modelName, port = 8000) => {
    const res = await fetch(`http://127.0.0.1:${port}/models/${encodeURIComponent(modelName)}/cached`);
    const data = await res.json();
    return data.cached as boolean;
  },
  downloadModel: (modelName, onProgress, port = 8000) => {
    const controller = new AbortController();
    (async () => {
      const res = await fetch(`http://127.0.0.1:${port}/models/${encodeURIComponent(modelName)}/download`, {
        method: 'POST',
        signal: controller.signal,
      });
      const reader = res.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        for (const line of text.split('\n')) {
          if (!line.startsWith('data:')) continue;
          try {
            const data = JSON.parse(line.slice(5).trim()) as DownloadProgress;
            onProgress(data);
          } catch { /* skip malformed lines */ }
        }
      }
    })().catch(() => {});
    return () => controller.abort();
  },
  reloadModel: (port = 8000) => fetch(`http://127.0.0.1:${port}/models/reload`, { method: 'POST' })
    .then(() => ({ success: true }) as OpResult),

  // Twitch
  twitchStartAuth: () => invoke<void>('twitch_start_auth'),
  twitchGetAuthStatus: () => invoke<boolean>('twitch_get_auth_status'),
  twitchClearAuth: () => invoke<boolean>('twitch_clear_auth'),
  twitchTestEvent: (eventType) => invoke<OpResult>('twitch_test_event', { event_type: eventType }),
  getTwitchStatus: () => invoke<TwitchStatus>('get_twitch_status'),
  onTwitchAuthStatus: (cb) => makeListener<{ success: boolean }>('twitch-auth-status', cb),

  // Profiles / Training
  openTrainingWindow: (profile) => { invoke('open_training_window', { profile }); },
  broadcastProfilesUpdated: () => { invoke('broadcast_profiles_updated'); },
  onProfilesUpdated: (cb) => makeListener<void>('profiles-updated', () => cb()),
  onTrainingProfileChanged: (cb) => makeListener<string>('training-profile-changed', cb),
};
