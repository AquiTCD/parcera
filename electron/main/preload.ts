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
});
