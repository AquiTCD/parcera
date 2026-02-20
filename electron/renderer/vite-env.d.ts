/// <reference types="vite/client" />

import type { ParceraSettings } from '../shared/types';

export interface ElectronAPI {
  getSettings: () => Promise<ParceraSettings>;
  saveSettings: (settings: ParceraSettings) => Promise<{ success: boolean; error?: string }>;
  getDefaultSettings: () => Promise<ParceraSettings>;
  selectDirectory: (currentPath?: string) => Promise<string | null>;
  onSettingsChanged: (callback: (settings: ParceraSettings) => void) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
