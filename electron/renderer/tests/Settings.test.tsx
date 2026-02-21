import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
// Setup Electron Mock BEFORE any imports that might use it
const mockElectron = {
  getSettings: vi.fn(),
  onSettingsChanged: vi.fn(() => vi.fn()),
  saveSettings: vi.fn(),
  selectDirectory: vi.fn(),
  resolveLocalPath: vi.fn((p) => `file://${p}`),
  getDefaultSettings: vi.fn(),
  getAvatarWindowBounds: vi.fn(),
};
(window as any).electronAPI = mockElectron;
vi.stubGlobal('electronAPI', mockElectron);

import { Settings } from '../components/Settings';

// Mock fetch
global.fetch = vi.fn().mockResolvedValue({
  json: async () => ({ success: true })
} as any);

const dummySettings = {
  verbose: false,
  avatars: { user: { assets_dir: '' }, ai: { assets_dir: '' } },
  llm: { provider: 'gemini', providers: { gemini: {} } },
  stt: { provider: 'faster_whisper', providers: { faster_whisper: {} } },
  tts: { provider: 'voicevox', providers: { voicevox: {} } },
  electron: { port: 8080, windows: { user: {}, ai: {} } }
};

describe('Settings Integration Test', () => {
  let Settings;

  beforeAll(async () => {
    const mod = await import('@/components/Settings');
    Settings = mod.Settings;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockElectron.getSettings.mockResolvedValue(dummySettings);
  });

  it('renders settings after loading', async () => {
    render(<Settings />);

    // Wait for loading to finish and check for the title
    await waitFor(() => {
      expect(screen.queryByText(/ローディング/)).not.toBeInTheDocument();
      expect(screen.getByText(/Parcera 設定/)).toBeInTheDocument();
    }, { timeout: 4000 });
  });

  it('can click a tab and see content', async () => {
    render(<Settings />);

    await waitFor(() => {
      expect(screen.queryByText(/ローディング/)).not.toBeInTheDocument();
    });

    const tab = screen.getByText(/体・アバター/);
    fireEvent.click(tab);

    await waitFor(() => {
      expect(screen.getByText(/USERアバター/)).toBeInTheDocument();
    });
  });
});
