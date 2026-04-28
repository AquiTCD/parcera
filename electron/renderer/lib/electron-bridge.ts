import type { ParceraAPI } from './bridge';

// window.electronAPI is injected by Electron's contextBridge (preload.ts).
// This module wraps every call so components never reference window.electronAPI directly,
// enabling a clean swap to tauri-bridge.ts when migrating to Tauri.
const e = () => (window as any).electronAPI;

export const api: ParceraAPI = {
  get platform(): string {
    return e().platform;
  },

  // Settings
  getSettings: () => e().getSettings(),
  getDefaultSettings: () => e().getDefaultSettings(),
  saveSettings: (settings) => e().saveSettings(settings),
  updateSetting: (key, value) => e().updateSetting(key, value),
  reloadSettings: () => e().reloadSettings(),
  onSettingsChanged: (cb) => {
    // preload.ts onSettingsChanged returns void (no unsubscribe support yet),
    // so we return a no-op to satisfy the ParceraAPI contract.
    e().onSettingsChanged(cb);
    return () => {};
  },

  // Window
  resizeWindow: (width, height) => e().resizeWindow(width, height),
  setResizable: (resizable) => e().setResizable(resizable),
  closeWindow: () => e().closeWindow(),
  getWindowBounds: () => e().getWindowBounds(),
  saveWindowBounds: (type) => e().saveWindowBounds(type),
  getAvatarWindowBounds: (type) => e().getAvatarWindowBounds(type),

  // FS / Dialog
  selectDirectory: (currentPath?) => e().selectDirectory(currentPath),
  resolveLocalPath: (filePath) => e().resolveLocalPath(filePath),

  // Logs
  getLogHistory: () => e().getLogHistory(),
  onLogMessage: (cb) => e().onLogMessage(cb),

  // Models
  checkModelCached: (modelName, port?) => e().checkModelCached(modelName, port),
  downloadModel: (modelName, onProgress, port?) => e().downloadModel(modelName, onProgress, port),
  reloadModel: (port?) => e().reloadModel(port),

  // Twitch
  twitchStartAuth: () => e().twitchStartAuth(),
  twitchGetAuthStatus: () => e().twitchGetAuthStatus(),
  twitchClearAuth: () => e().twitchClearAuth(),
  twitchTestEvent: (eventType) => e().twitchTestEvent(eventType),
  getTwitchStatus: () => e().getTwitchStatus(),
  onTwitchAuthStatus: (cb) => e().onTwitchAuthStatus(cb),

  // Profiles / Training
  openTrainingWindow: (profile) => e().openTrainingWindow(profile),
  broadcastProfilesUpdated: () => e().broadcastProfilesUpdated(),
  onProfilesUpdated: (cb) => e().onProfilesUpdated(cb),
  onTrainingProfileChanged: (cb) => e().onTrainingProfileChanged(cb),
};
