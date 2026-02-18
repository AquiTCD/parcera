import { contextBridge, ipcRenderer } from 'electron';
import type { ParceraSettings } from '../shared/types';

contextBridge.exposeInMainWorld('electronAPI', {
  getSettings: (): Promise<ParceraSettings> => ipcRenderer.invoke('get-settings'),
  resizeWindow: (width: number, height: number): void => ipcRenderer.send('resize-window', width, height),
});
