/**
 * Parcera: Shared Application State
 *
 * Single source of truth for all mutable state shared across modules.
 * Import `state` to read/write, `logStatus` to update the status line.
 */

export const state = {
  avatarType: 'user',
  settings: {},
  threshold: 15,
  isAIPlaying: false,
  isInitialized: false,
  persistentStatus: 'Waiting for interaction...',
};

export function logStatus(msg) {
  console.log(`[Parcera] ${msg}`);
  state.persistentStatus = msg;
}
