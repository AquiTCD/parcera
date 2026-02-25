/**
 * Parcera: Shared Type Definitions
 *
 * Single source of truth for types shared between Main and Renderer processes.
 * These types mirror the structure of configs/settings.default.yaml.
 * When modifying settings, update these types to match.
 */

// ─── Settings (mirrors configs/settings.default.yaml) ───

export interface ParceraSettings {
  verbose?: boolean;
  profile_mode?: boolean;
  simple_log?: boolean;                  // If true, only chat logs are shown in terminal
  log_level?: string;                    // "DEBUG" | "INFO" | "WARNING" | "ERROR"
  merge_request_threshold?: number;      // Seconds to merge consecutive requests
  response_sensitivity?: string;         // "high" | "medium" | "low"
  force_keywords?: string[];
  llm?: LLMSettings;
  stt?: STTSettings;
  tts?: TTSSettingsConfig;
  vad?: VADSettings;
  electron?: ElectronSettings;
  avatars?: AvatarSettings;
  ai_profile?: AIProfileSettings;
  user_profile?: UserProfileSettings;
  knowledge?: string;
}

export interface LLMSettings {
  provider?: string;
  providers?: {
    gemini?: LLMProviderConfig;
    openai?: LLMProviderConfig;
    [key: string]: LLMProviderConfig | undefined;
  };
}

export interface LLMProviderConfig {
  model?: string;
  temperature?: number;
  persist_history?: boolean;
  option_split_threshold?: number;
  api_key?: string;
}

export interface STTSettings {
  provider?: string;
  ignore_sentences?: string[];           // Phrases to ignore after STT
  dictionary?: STTDictionarySettings;    // New field for Whisper tuning
  providers?: {
    faster_whisper?: STTProviderConfig;
    google?: STTProviderConfig;
    azure?: STTProviderConfig;
    [key: string]: STTProviderConfig | undefined;
  };
}

export interface STTProviderConfig {
  model?: string;
  device?: string;
  compute_type?: string;
  whisper_vad_filter?: boolean;
  api_key?: string;
  region?: string;
}

export interface TTSSettingsConfig {
  provider?: string;
  settings?: TTSSettings;
  providers?: {
    aivisspeech?: TTSProviderConfig;
    voicevox?: TTSProviderConfig;
    google?: TTSProviderConfig;
    [key: string]: TTSProviderConfig | undefined;
  };
}

export interface TTSSettings {
  speedScale?: number;
  pitchScale?: number;
  intonationScale?: number;
  tempoDynamicsScale?: number;
  volumeScale?: number;
  prePhonemeLength?: number;
  postPhonemeLength?: number;
}

export interface TTSProviderConfig {
  api_url?: string;
  engine_path?: string;
  speaker_id?: number;
  style_id?: number;
  language?: string;
  voice?: string;
  speaking_rate?: number;
  pitch?: number;
  volume_gain_db?: number;
  api_key?: string;
}

export interface VADSettings {
  volume_db_threshold?: number;
  silence_duration_threshold?: number;
  max_duration?: number;
  start_muted?: boolean;
}

export interface ElectronSettings {
  port?: number;
  ai_audio_sample_rate?: number;
  gpu_acceleration?: boolean;        // If false, calls app.disableHardwareAcceleration()
  mic_device_id?: string;            // Selected microphone device ID
  windows?: Record<string, WindowConfig>;
}

export interface WindowConfig {
  width?: number;
  height?: number;
  x?: number;        // Saved X position
  y?: number;        // Saved Y position
  alwaysOnTop?: boolean;
  locked?: boolean;  // Window drag lock
  control_corner?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export interface AvatarSettings {
  show_debug?: boolean;
  user?: AvatarConfig;
  ai?: AvatarConfig;
  blink_interval_min?: number;
  blink_interval_max?: number;
  mouth_hold_time?: number;
  breathe_scale?: number;
  breathe_amplitude?: number;
  breathe_duration?: number;
  chroma_key_enabled?: boolean;
  chroma_key_color?: 'green' | 'blue';
  [key: string]: AvatarConfig | boolean | number | string | undefined;
}

export interface AvatarConfig {
  name?: string;
  assets_dir?: string;
  flip_horizontal?: boolean;
  chroma_key_enabled?: boolean;
  chroma_key_color?: 'green' | 'blue';
}

export interface AIProfileSettings {
  name?: string;
  species?: string;
  gender?: string;
  personality?: string;
  tone?: string;
  first_person?: string;
  hobbies?: string;
}

export interface UserProfileSettings {
  name?: string;
  calling?: string;
  gender?: string;
  mode?: 'soliloquy' | 'conversation';
}

export interface STTDictionarySettings {
  specific_keywords?: string[];
}

// ─── Application Types ───

export type AvatarType = 'user' | 'ai';

/** Messages sent from the Python AI server via WebSocket */
export type ServerMessage =
  | { type: 'start' }
  | { type: 'thinking'; text: string }
  | { type: 'chunk'; audio_data: string }
  | { type: 'stop' };

/** Log message from the Python sidecar process */
export interface SidecarLogMessage {
  source: 'stdout' | 'stderr';
  text: string;
  timestamp: string;
}

export interface ElectronAPI {
  getSettings: () => Promise<ParceraSettings>;
  reloadSettings: () => Promise<ParceraSettings>;
  resizeWindow: (width: number, height: number) => void;
  onSettingsChanged: (callback: (settings: ParceraSettings) => void) => () => void;
  saveSettings: (settings: ParceraSettings) => Promise<{ success: boolean; error?: string }>;
  getDefaultSettings: () => Promise<ParceraSettings>;
  selectDirectory: (currentPath?: string) => Promise<string | null>;
  saveWindowBounds: (type: 'user' | 'ai') => Promise<{ success: boolean; error?: string }>;
  getWindowBounds: () => Promise<{ x: number; y: number; width: number; height: number } | null>;
  getAvatarWindowBounds: (type: 'user' | 'ai') => Promise<{ x: number; y: number; width: number; height: number } | null>;
  resolveLocalPath: (filePath: string) => string;
  setResizable: (resizable: boolean) => void;
  closeWindow: () => void;
  onLogMessage: (callback: (log: SidecarLogMessage) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
