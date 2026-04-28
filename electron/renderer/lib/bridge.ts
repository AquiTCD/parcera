import type { ParceraSettings } from '../../shared/types';

export type Rect = { x: number; y: number; width: number; height: number };

export type LogEntry = { source: 'stdout' | 'stderr'; text: string; time?: number };

export type TwitchStatus = {
  initialized: boolean;
  user?: { display_name: string; login: string };
  session_id?: string;
};

export type OpResult = { success: boolean; error?: string };

export type DownloadProgress = {
  progress: number;
  downloaded_mb?: number;
  total_mb?: number;
  file?: string;
  status?: string;
  error?: string;
};

/**
 * Platform-agnostic API surface for Parcera.
 * Electron implementation: electron-bridge.ts (wraps window.electronAPI)
 * Tauri implementation: tauri-bridge.ts (uses @tauri-apps/api) — future
 */
export interface ParceraAPI {
  readonly platform: string;

  // Settings
  getSettings(): Promise<ParceraSettings>;
  getDefaultSettings(): Promise<ParceraSettings>;
  saveSettings(settings: ParceraSettings): Promise<OpResult>;
  updateSetting(key: string, value: unknown): Promise<OpResult>;
  reloadSettings(): Promise<ParceraSettings>;
  onSettingsChanged(cb: (s: ParceraSettings) => void): () => void;

  // Window
  resizeWindow(width: number, height: number): void;
  setResizable(resizable: boolean): void;
  closeWindow(): void;
  getWindowBounds(): Promise<Rect | null>;
  saveWindowBounds(type: 'user' | 'ai'): Promise<OpResult>;
  getAvatarWindowBounds(type: 'user' | 'ai'): Promise<Rect | null>;

  // FS / Dialog
  selectDirectory(currentPath?: string): Promise<string | null>;
  resolveLocalPath(filePath: string): string;

  // Logs
  getLogHistory(): Promise<LogEntry[]>;
  onLogMessage(cb: (log: LogEntry) => void): () => void;

  // Models (HTTP direct calls to Python backend)
  checkModelCached(modelName: string, port?: number): Promise<boolean>;
  downloadModel(modelName: string, onProgress: (p: DownloadProgress) => void, port?: number): () => void;
  reloadModel(port?: number): Promise<OpResult>;

  // Twitch
  twitchStartAuth(): Promise<void>;
  twitchGetAuthStatus(): Promise<boolean>;
  twitchClearAuth(): Promise<boolean>;
  twitchTestEvent(eventType: string): Promise<OpResult>;
  getTwitchStatus(): Promise<TwitchStatus>;
  onTwitchAuthStatus(cb: (status: { success: boolean }) => void): () => void;

  // Profiles / Training
  openTrainingWindow(profile: string): void;
  broadcastProfilesUpdated(): void;
  onProfilesUpdated(cb: () => void): () => void;
  onTrainingProfileChanged(cb: (profile: string) => void): () => void;
}
