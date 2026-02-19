/**
 * Parcera: Shared Type Definitions
 *
 * Single source of truth for types shared between Main and Renderer processes.
 * These types mirror the structure of configs/settings.yaml.
 * When modifying settings.yaml, update these types to match.
 */

// ─── Settings (mirrors configs/settings.yaml) ───

export interface ParceraSettings {
  verbose?: boolean;
  log_level?: string;                    // "DEBUG" | "INFO" | "WARNING" | "ERROR"
  merge_request_threshold?: number;      // Seconds to merge consecutive requests
  force_keywords?: string[];
  llm_model?: string;
  llm_temperature?: number;
  option_split_threshold?: number;
  active_engine?: string;                // "aivisspeech" | "voicevox"
  engines?: Record<string, EngineConfig>;
  tts_settings?: TTSSettings;
  vad?: VADSettings;
  electron?: ElectronSettings;
  avatars?: AvatarSettings;
}

export interface EngineConfig {
  api_url?: string;
  engine_path?: string;
  speaker_id?: number;
  style_id?: number;
}

export interface TTSSettings {
  speedScale?: number;
  tempoDynamicScale?: number;
  volumeScale?: number;
  prePhonemeLength?: number;
  postPhonemeLength?: number;
}

export interface VADSettings {
  volume_db_threshold?: number;          // dB, single source of truth for audio sensitivity
  max_duration?: number;                 // seconds
}

export interface ElectronSettings {
  port?: number;                         // WebSocket port, ws://localhost:{port}/ws
  ai_audio_sample_rate?: number;         // Hz — AudioContext sample rate for AI window
  windows?: Record<string, WindowConfig>;
}

export interface WindowConfig {
  width?: number;
  height?: number;
  alwaysOnTop?: boolean;
}

export interface AvatarSettings {
  show_debug?: boolean;
  blink_interval_min?: number;           // ms
  blink_interval_max?: number;           // ms
  mouth_hold_time?: number;              // ms
  breathe_scale?: number;                // Scale factor for breathing animation
  breathe_amplitude?: number;            // Vertical movement in pixels
  breathe_duration?: number;             // Duration of one breath cycle in ms
  [key: string]: AvatarConfig | boolean | number | undefined;
}

export interface AvatarConfig {
  name?: string;
  assets_dir?: string;
}

// ─── Application Types ───

export type AvatarType = 'user' | 'ai';

/** Messages sent from the Python AI server via WebSocket */
export type ServerMessage =
  | { type: 'start' }
  | { type: 'thinking'; text: string }
  | { type: 'chunk'; audio_data: string }
  | { type: 'stop' };
