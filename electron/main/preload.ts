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
  getDefaultSettings: (): Promise<ParceraSettings> => ipcRenderer.invoke('get-default-settings'),
  selectDirectory: (currentPath?: string): Promise<string | null> => ipcRenderer.invoke('select-directory', currentPath),
  saveWindowBounds: (type: 'user' | 'ai'): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('save-window-bounds', type),
  getWindowBounds: (): Promise<{ x: number; y: number; width: number; height: number } | null> => ipcRenderer.invoke('get-window-bounds'),
  getAvatarWindowBounds: (type: 'user' | 'ai'): Promise<{ x: number; y: number; width: number; height: number } | null> => ipcRenderer.invoke('get-avatar-window-bounds', type),
  resolveLocalPath: (filePath: string): string => {
    // Treat /assets/ as internal web-root paths
    if (filePath.startsWith('/assets/')) return filePath;
    // Absolute paths on Mac/Linux or Windows
    if (filePath.startsWith('/') || /^[a-zA-Z]:\\/.test(filePath)) {
      return `parcera-asset://${filePath}`;
    }
    return filePath;
  },
  onLogMessage: (callback: (log: any) => void): (() => void) => {
    const listener = (_event: any, log: any) => callback(log);
    ipcRenderer.on('sidecar-log', listener);
    return () => ipcRenderer.removeListener('sidecar-log', listener);
  },
});
