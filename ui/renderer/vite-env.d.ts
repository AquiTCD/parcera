/// <reference types="vite/client" />

import type { ParceraSettings } from '../shared/types';

export interface ElectronAPI {
  getSettings: () => Promise<ParceraSettings>;
  saveSettings: (settings: ParceraSettings) => Promise<{ success: boolean; error?: string }>;
  getDefaultSettings: () => Promise<ParceraSettings>;
  selectDirectory: (currentPath?: string) => Promise<string | null>;
  onSettingsChanged: (callback: (settings: ParceraSettings) => void) => void;
  saveWindowBounds: (type: 'user' | 'ai') => Promise<{ success: boolean; error?: string }>;
  getWindowBounds: () => Promise<{ x: number; y: number; width: number; height: number } | null>;
  getAvatarWindowBounds: (type: 'user' | 'ai') => Promise<{ x: number; y: number; width: number; height: number } | null>;
  resolveLocalPath: (filePath: string) => string;
  onLogMessage: (callback: (log: any) => void) => () => void;
  getLogHistory: () => Promise<any[]>;
  twitchStartAuth: () => Promise<void>;
  twitchGetAuthStatus: () => Promise<boolean>;
  twitchClearAuth: () => Promise<boolean>;
  twitchTestEvent: (eventType: string) => Promise<{ success: boolean; error?: string }>;
  onTwitchAuthStatus: (callback: (status: { success: boolean }) => void) => () => void;
  getTwitchStatus: () => Promise<{ initialized: boolean; user?: { display_name: string; login: string }; session_id?: string }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
