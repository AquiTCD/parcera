import { vi } from 'vitest';

/**
 * Base electronAPI mock shared across all section/settings tests.
 * Each test file spreads this and adds component-specific methods.
 */
export const createBaseMockElectron = () => ({
  getSettings: vi.fn(),
  onSettingsChanged: vi.fn(() => vi.fn()),
  saveSettings: vi.fn(),
  selectDirectory: vi.fn(),
  resolveLocalPath: vi.fn((p: string) => `file://${p}`),
  getDefaultSettings: vi.fn(),
  getAvatarWindowBounds: vi.fn(),
  getLogHistory: vi.fn().mockResolvedValue([]),
  onLogMessage: vi.fn(() => vi.fn()),
  closeWindow: vi.fn(),
});

export type MockElectron = ReturnType<typeof createBaseMockElectron>;
