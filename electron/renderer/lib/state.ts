/**
 * Parcera: Shared Application State
 *
 * Single source of truth for all mutable state shared across modules.
 */

// --- Type Definitions ---

/** Shape of settings.yaml as loaded by Electron main process */
export interface ParceraSettings {
  verbose?: boolean;
  log_level?: string;
  merge_request_threshold?: number;
  force_keywords?: string[];
  llm_model?: string;
  llm_temperature?: number;
  option_split_threshold?: number;
  active_engine?: string;
  engines?: Record<string, {
    api_url?: string;
    engine_path?: string;
    speaker_id?: number;
    style_id?: number;
  }>;
  tts_settings?: {
    speedScale?: number;
    tempoDynamicScale?: number;
    volumeScale?: number;
    prePhonemeLength?: number;
    postPhonemeLength?: number;
  };
  vad?: {
    volume_db_threshold?: number;
    max_duration?: number;
  };
  electron?: {
    port?: number;
    windows?: Record<string, {
      width?: number;
      height?: number;
      alwaysOnTop?: boolean;
    }>;
  };
  avatars?: AvatarSettings;
}

export interface AvatarSettings {
  show_debug?: boolean;
  blink_interval_min?: number;
  blink_interval_max?: number;
  mouth_hold_time?: number;
  breathe_scale?: number;
  breathe_amplitude?: number;
  breathe_duration?: number;
  [key: string]: AvatarConfig | boolean | number | undefined;
}

export interface AvatarConfig {
  name?: string;
  assets_dir?: string;
}

export type AvatarType = 'user' | 'ai';

/** Messages sent from the Python AI server */
export type ServerMessage =
  | { type: 'start' }
  | { type: 'thinking'; text: string }
  | { type: 'chunk'; audio_data: string }
  | { type: 'stop' };

// --- State ---

export interface AppState {
  avatarType: AvatarType;
  settings: ParceraSettings;
  threshold: number;
  isAIPlaying: boolean;
  isInitialized: boolean;
  persistentStatus: string;
}

export const state: AppState = {
  avatarType: 'user',
  settings: {},
  threshold: 15,
  isAIPlaying: false,
  isInitialized: false,
  persistentStatus: 'Waiting for interaction...',
};

export function logStatus(msg: string): void {
  console.log(`[Parcera] ${msg}`);
  state.persistentStatus = msg;
}
