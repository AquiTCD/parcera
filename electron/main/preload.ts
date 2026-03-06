import { contextBridge, ipcRenderer } from 'electron';
import type { ParceraSettings } from '../shared/types';

contextBridge.exposeInMainWorld('electronAPI', {
  getSettings: (): Promise<ParceraSettings> => ipcRenderer.invoke('get-settings'),
  reloadSettings: (): Promise<ParceraSettings> => ipcRenderer.invoke('reload-settings'),
  resizeWindow: (width: number, height: number): void => ipcRenderer.send('resize-window', width, height),
  onSettingsChanged: (callback: (settings: ParceraSettings) => void): void => {
    ipcRenderer.on('settings-changed', (_event, settings: ParceraSettings) => callback(settings));
  },
  saveSettings: (settings: ParceraSettings): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('save-settings', settings),
  updateSetting: (key: string, value: any): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('update-setting', key, value),
  getDefaultSettings: (): Promise<ParceraSettings> => ipcRenderer.invoke('get-default-settings'),
  selectDirectory: (currentPath?: string): Promise<string | null> => ipcRenderer.invoke('select-directory', currentPath),
  saveWindowBounds: (type: 'user' | 'ai'): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('save-window-bounds', type),
  getWindowBounds: (): Promise<{ x: number; y: number; width: number; height: number } | null> => ipcRenderer.invoke('get-window-bounds'),
  getAvatarWindowBounds: (type: 'user' | 'ai'): Promise<{ x: number; y: number; width: number; height: number } | null> => ipcRenderer.invoke('get-avatar-window-bounds', type),
  resolveLocalPath: (filePath: string): string => {
    // Internal assets should be relative to the app distribution
    if (filePath.startsWith('assets/') || filePath.startsWith('/assets/')) {
      return filePath.startsWith('/') ? filePath.slice(1) : filePath;
    }
    // Absolute paths on Mac/Linux or Windows
    if (filePath.startsWith('/') || /^[a-zA-Z]:\\/.test(filePath)) {
      return `parcera-asset://${filePath}`;
    }
    return filePath;
  },
  setResizable: (resizable: boolean): void => ipcRenderer.send('set-resizable', resizable),
  closeWindow: (): void => ipcRenderer.send('close-window'),
  onLogMessage: (callback: (log: any) => void): (() => void) => {
    const listener = (_event: any, log: any) => callback(log);
    ipcRenderer.on('sidecar-log', listener);
    return () => ipcRenderer.removeListener('sidecar-log', listener);
  },
  getLogHistory: (): Promise<any[]> => ipcRenderer.invoke('get-log-history'),

  // --- Model Management ---
  checkModelCached: async (modelName: string, port: number = 8676): Promise<boolean> => {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/models/check?name=${encodeURIComponent(modelName)}`);
      const data = await res.json();
      return data.cached === true;
    } catch {
      return false;
    }
  },

  downloadModel: (
    modelName: string,
    onProgress: (progress: { progress: number; downloaded_mb?: number; total_mb?: number; file?: string; status?: string; error?: string }) => void,
    port: number = 8676
  ): (() => void) => {
    const controller = new AbortController();
    const url = `http://127.0.0.1:${port}/models/download?name=${encodeURIComponent(modelName)}`;

    (async () => {
      try {
        const res = await fetch(url, { signal: controller.signal });
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) return;
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                onProgress(data);
              } catch { /* ignore parse errors */ }
            }
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          onProgress({ progress: -1, status: 'error', error: err.message });
        }
      }
    })();

    // Return cancel function
    return () => controller.abort();
  },

  reloadModel: async (port: number = 8676): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/models/reload`, { method: 'POST' });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // --- Twitch ---
  twitchStartAuth: (): Promise<void> => ipcRenderer.invoke('twitch-start-auth'),
  twitchGetAuthStatus: (): Promise<boolean> => ipcRenderer.invoke('twitch-get-auth-status'),
  twitchClearAuth: (): Promise<boolean> => ipcRenderer.invoke('twitch-clear-auth'),
  twitchTestEvent: (eventType: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('twitch-test-event', eventType),
  onTwitchAuthStatus: (callback: (status: { success: boolean }) => void): (() => void) => {
    const listener = (_event: any, status: { success: boolean }) => callback(status);
    ipcRenderer.on('twitch-auth-status', listener);
    return () => ipcRenderer.removeListener('twitch-auth-status', listener);
  },
});
