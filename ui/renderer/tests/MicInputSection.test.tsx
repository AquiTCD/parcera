import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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

import { MicInputSection } from '../components/sections/MicInputSection';

// jsdom doesn't have mediaDevices — mock it
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    enumerateDevices: vi.fn().mockResolvedValue([]),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  },
  configurable: true,
});

const dummySettings = {
  vad: {
    volume_db_threshold: -20,
    silence_duration_threshold: 0.8,
    max_duration: 30,
    start_muted: false,
  },
  electron: {
    port: 8676,
    mic_device_id: 'default',
    windows: {},
  },
  stt: {
    provider: 'faster_whisper',
    ignore_sentences: ['あー', 'えーと'],
    providers: { faster_whisper: {} },
  },
  merge_request_threshold: 0.5,
  force_keywords: ['ねえ'],
  response_sensitivity: 'medium',
};

const mockProps = {
  settings: dummySettings as any,
  defaultSettings: dummySettings as any,
  updateRoot: vi.fn(),
  updateNested: vi.fn(),
  updateProvider: vi.fn(),
  setStatus: vi.fn(),
};

describe('MicInputSection', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('感度', () => {
    it('renders 感度 card heading', () => {
      render(<MicInputSection {...mockProps} />);
      expect(screen.getByText('感度')).toBeInTheDocument();
    });

    it('renders microphone device selector', () => {
      render(<MicInputSection {...mockProps} />);
      expect(screen.getByText('使用するマイク')).toBeInTheDocument();
    });

    it('renders start muted toggle', () => {
      render(<MicInputSection {...mockProps} />);
      expect(screen.getByText(/起動時ミュート/)).toBeInTheDocument();
    });

    it('renders volume threshold slider', () => {
      render(<MicInputSection {...mockProps} />);
      expect(screen.getByText(/音量閾値/)).toBeInTheDocument();
    });
  });

  describe('無音判定', () => {
    it('renders 無音判定 heading', () => {
      render(<MicInputSection {...mockProps} />);
      expect(screen.getByText('無音判定')).toBeInTheDocument();
    });

    it('renders silence duration threshold input', () => {
      render(<MicInputSection {...mockProps} />);
      expect(screen.getByText(/発話終了判定の無音時間/)).toBeInTheDocument();
    });

    it('renders max duration input', () => {
      render(<MicInputSection {...mockProps} />);
      expect(screen.getByText(/最大録音時間/)).toBeInTheDocument();
    });
  });

  describe('音声連結', () => {
    it('renders 音声連結 heading', () => {
      render(<MicInputSection {...mockProps} />);
      expect(screen.getByText('音声連結')).toBeInTheDocument();
    });

    it('renders merge threshold input', () => {
      render(<MicInputSection {...mockProps} />);
      expect(screen.getByText(/発話の結合待機時間/)).toBeInTheDocument();
    });

    it('renders ignore phrases input', () => {
      render(<MicInputSection {...mockProps} />);
      expect(screen.getByText(/無視するフレーズ/)).toBeInTheDocument();
    });
  });

  describe('IAの分離確認', () => {
    it('does NOT render STT provider selector (it belongs to 詳細設定)', () => {
      render(<MicInputSection {...mockProps} />);
      expect(screen.queryByText(/STTプロバイダ/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Faster Whisper/)).not.toBeInTheDocument();
    });
  });
});
