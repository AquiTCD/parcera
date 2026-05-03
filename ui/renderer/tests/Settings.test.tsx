import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

vi.mock('@/lib/api', () => ({
  api: {
    platform: 'darwin',
    getSettings: vi.fn(),
    getDefaultSettings: vi.fn(),
    saveSettings: vi.fn(),
    updateSetting: vi.fn().mockResolvedValue({ success: true }),
    reloadSettings: vi.fn(),
    onSettingsChanged: vi.fn(() => vi.fn()),
    resizeWindow: vi.fn(),
    setResizable: vi.fn(),
    closeWindow: vi.fn(),
    getWindowBounds: vi.fn().mockResolvedValue(null),
    saveWindowBounds: vi.fn().mockResolvedValue({ success: true }),
    getAvatarWindowBounds: vi.fn().mockResolvedValue(null),
    selectDirectory: vi.fn(),
    resolveLocalPath: vi.fn((p: string) => `file://${p}`),
    getLogHistory: vi.fn().mockResolvedValue([]),
    onLogMessage: vi.fn(() => vi.fn()),
    checkModelCached: vi.fn().mockResolvedValue(false),
    downloadModel: vi.fn(() => vi.fn()),
    reloadModel: vi.fn().mockResolvedValue({ success: true }),
    twitchStartAuth: vi.fn().mockResolvedValue(undefined),
    twitchGetAuthStatus: vi.fn().mockResolvedValue(false),
    twitchClearAuth: vi.fn().mockResolvedValue(true),
    twitchTestEvent: vi.fn().mockResolvedValue({ success: true }),
    getTwitchStatus: vi.fn().mockResolvedValue({ initialized: false }),
    onTwitchAuthStatus: vi.fn(() => vi.fn()),
    openTrainingWindow: vi.fn(),
    broadcastProfilesUpdated: vi.fn(),
    onProfilesUpdated: vi.fn(() => vi.fn()),
    onTrainingProfileChanged: vi.fn(() => vi.fn()),
  }
}));

import { Settings } from '../components/Settings';
import { api } from '../lib/api';

Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    enumerateDevices: vi.fn().mockResolvedValue([]),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  },
  configurable: true,
});

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => [],
} as any);

const dummySettings = {
  verbose: false,
  log_level: 'INFO',
  simple_log: false,
  profile_mode: false,
  avatars: { user: { assets_dir: '' }, ai: { assets_dir: '' }, show_debug: false },
  llm: { provider: 'gemini', providers: { gemini: { temperature: 0.7 }, openai: {}, local: {} } },
  stt: { provider: 'faster_whisper', ignore_sentences: [], providers: { faster_whisper: {}, google: {}, azure: {} } },
  tts: {
    provider: 'aivisspeech',
    settings: { speedScale: 1.0, intonationScale: 1.0, pitchScale: 0, volumeScale: 1.0 },
    providers: { aivisspeech: { api_url: 'http://127.0.0.1:10101' }, voicevox: {}, google: {} },
  },
  vad: { volume_db_threshold: -20, silence_duration_threshold: 0.8, max_duration: 30, start_muted: false },
  app: { port: 8676, windows: { user: {}, ai: {} }, ai_audio_sample_rate: 16000, gpu_acceleration: true },
  twitch: { enabled: false },
  knowledge: '',
};

describe('Settings Integration Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getSettings).mockResolvedValue(dummySettings as any);
    vi.mocked(api.getDefaultSettings).mockResolvedValue(dummySettings as any);
  });

  it('renders settings after loading', async () => {
    render(<Settings />);
    await waitFor(() => {
      expect(screen.queryByText(/ローディング/)).not.toBeInTheDocument();
      expect(screen.getByText('キャラクター')).toBeInTheDocument();
    }, { timeout: 4000 });
  });

  it('can click sidebar nav and see content', async () => {
    render(<Settings />);
    await waitFor(() => expect(screen.queryByText(/ローディング/)).not.toBeInTheDocument());

    fireEvent.click(screen.getByText('マイク・入力'));
    await waitFor(() => {
      expect(screen.getByText('感度')).toBeInTheDocument();
    });
  });

  it('calls saveSettings when save button is clicked', async () => {
    vi.mocked(api.saveSettings).mockResolvedValue({ success: true });
    render(<Settings />);
    await waitFor(() => expect(screen.queryByText(/ローディング/)).not.toBeInTheDocument());

    fireEvent.click(screen.getByText('保存する'));
    await waitFor(() => {
      expect(vi.mocked(api.saveSettings)).toHaveBeenCalled();
      expect(screen.getByText(/設定を保存しました/)).toBeInTheDocument();
    });
  });
});
