/**
 * Parcera: Shared Application State
 *
 * Single source of truth for all mutable state shared across modules.
 * Type definitions are imported from shared/types.ts (the canonical source).
 */

// Re-export all shared types so existing imports continue to work
export type {
  ParceraSettings,
  EngineConfig,
  TTSSettings,
  VADSettings,
  ElectronSettings,
  WindowConfig,
  AvatarSettings,
  AvatarConfig,
  AvatarType,
  ServerMessage,
} from '../../shared/types';

import type { AvatarType, ParceraSettings } from '../../shared/types';

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
