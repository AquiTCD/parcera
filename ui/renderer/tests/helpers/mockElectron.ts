import { vi } from 'vitest';

/**
 * Complete electronAPI mock covering all ParceraAPI methods.
 * Each test file spreads this and overrides specific methods as needed.
 */
export const createBaseMockElectron = () => ({
  platform: 'darwin',

  // Settings
  getSettings: vi.fn(),
  getDefaultSettings: vi.fn(),
  saveSettings: vi.fn(),
  updateSetting: vi.fn().mockResolvedValue({ success: true }),
  reloadSettings: vi.fn(),
  onSettingsChanged: vi.fn(() => vi.fn()),

  // Window
  resizeWindow: vi.fn(),
  setResizable: vi.fn(),
  closeWindow: vi.fn(),
  getWindowBounds: vi.fn().mockResolvedValue(null),
  saveWindowBounds: vi.fn().mockResolvedValue({ success: true }),
  getAvatarWindowBounds: vi.fn().mockResolvedValue(null),

  // FS
  selectDirectory: vi.fn(),
  resolveLocalPath: vi.fn((p: string) => `file://${p}`),

  // Logs
  getLogHistory: vi.fn().mockResolvedValue([]),
  onLogMessage: vi.fn(() => vi.fn()),

  // Models
  checkModelCached: vi.fn().mockResolvedValue(false),
  downloadModel: vi.fn(() => vi.fn()),
  reloadModel: vi.fn().mockResolvedValue({ success: true }),

  // Twitch
  twitchStartAuth: vi.fn().mockResolvedValue(undefined),
  twitchGetAuthStatus: vi.fn().mockResolvedValue(false),
  twitchClearAuth: vi.fn().mockResolvedValue(true),
  twitchTestEvent: vi.fn().mockResolvedValue({ success: true }),
  getTwitchStatus: vi.fn().mockResolvedValue({ initialized: false }),
  onTwitchAuthStatus: vi.fn(() => vi.fn()),

  // Profiles / Training
  openTrainingWindow: vi.fn(),
  broadcastProfilesUpdated: vi.fn(),
  onProfilesUpdated: vi.fn(() => vi.fn()),
  onTrainingProfileChanged: vi.fn(() => vi.fn()),
});

export type MockElectron = ReturnType<typeof createBaseMockElectron>;
