import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  resizeWindow: (width, height) => ipcRenderer.send('resize-window', width, height),
});
