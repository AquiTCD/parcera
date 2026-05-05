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

import { AdvancedSection } from '../components/sections/AdvancedSection';

global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] } as any);

const dummySettings = {
  llm: {
    provider: 'gemini',
    providers: {
      gemini: { api_key: 'test-key', model: 'gemini-2.0-flash', temperature: 0.7 },
      openai: {},
      local: {},
    },
  },
  stt: {
    provider: 'faster_whisper',
    ignore_sentences: [],
    providers: {
      faster_whisper: { model: 'kotoba-whisper', device: 'auto' },
      google: {},
      azure: {},
    },
  },
  tts: {
    provider: 'aivisspeech',
    providers: {
      aivisspeech: { api_url: 'http://127.0.0.1:10101', engine_path: '' },
      voicevox: { api_url: 'http://127.0.0.1:50021' },
      google: { api_key: '' },
    },
  },
  app: { port: 8676 },
};

const mockProps = {
  settings: dummySettings as any,
  defaultSettings: dummySettings as any,
  updateRoot: vi.fn(),
  updateNested: vi.fn(),
  updateProvider: vi.fn(),
  setStatus: vi.fn(),
};

describe('AdvancedSection', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('AIモデル・プロバイダー', () => {
    it('renders the section heading', () => {
      render(<AdvancedSection {...mockProps} />);
      expect(screen.getByText('AIモデル・プロバイダー')).toBeInTheDocument();
    });
  });

  describe('LLM', () => {
    it('renders LLM subsection heading', () => {
      render(<AdvancedSection {...mockProps} />);
      expect(screen.getByText('LLM')).toBeInTheDocument();
    });

    it('renders LLM provider selector', () => {
      render(<AdvancedSection {...mockProps} />);
      expect(screen.getAllByText(/プロバイダー/).length).toBeGreaterThanOrEqual(1);
    });

    it('renders API key field', () => {
      render(<AdvancedSection {...mockProps} />);
      expect(screen.getByText(/APIキー/)).toBeInTheDocument();
    });
  });

  describe('STT', () => {
    it('renders STT subsection heading', () => {
      render(<AdvancedSection {...mockProps} />);
      expect(screen.getByText('STT')).toBeInTheDocument();
    });

    it('renders STT provider selector', () => {
      render(<AdvancedSection {...mockProps} />);
      // STT provider is rendered inside AdvancedSection (moved from MicInput)
      expect(screen.getAllByText(/プロバイダー/).length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('TTS接続設定', () => {
    it('renders TTS connection section heading', () => {
      render(<AdvancedSection {...mockProps} />);
      expect(screen.getByText('TTS接続設定')).toBeInTheDocument();
    });

    it('renders engine API URL for current TTS provider', () => {
      render(<AdvancedSection {...mockProps} />);
      expect(screen.getByText(/エンジンのAPI URL/)).toBeInTheDocument();
    });

    it('renders engine path', () => {
      render(<AdvancedSection {...mockProps} />);
      expect(screen.getByText(/エンジン起動パス/)).toBeInTheDocument();
    });
  });

  describe('Local LLM', () => {
    const localProps = {
      ...mockProps,
      settings: {
        ...dummySettings,
        llm: { ...dummySettings.llm, provider: 'local' },
      } as any,
    };

    it('shows Gemma preset option when local is selected', () => {
      render(<AdvancedSection {...localProps} />);
      expect(screen.getByText('Gemma 4 4B (MLX)')).toBeInTheDocument();
    });

    it('shows model select and hides API key when local is selected', () => {
      render(<AdvancedSection {...localProps} />);
      expect(screen.getByText('モデル')).toBeInTheDocument();
      expect(screen.queryByText(/APIキー/)).not.toBeInTheDocument();
    });

    it('shows 最大出力トークン数 field when local is selected', () => {
      render(<AdvancedSection {...localProps} />);
      expect(screen.getByText('最大出力トークン数')).toBeInTheDocument();
    });
  });

  describe('追加学習', () => {
    const localProps = {
      ...mockProps,
      settings: { ...dummySettings, llm: { ...dummySettings.llm, provider: 'local' } } as any,
    };

    it('renders 追加学習 heading when local LLM is selected', () => {
      render(<AdvancedSection {...localProps} />);
      expect(screen.getByText('追加学習')).toBeInTheDocument();
    });

    it('shows profile create and import buttons when local is selected', () => {
      render(<AdvancedSection {...localProps} />);
      expect(screen.getByRole('button', { name: '作成' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'インポート' })).toBeInTheDocument();
    });

    it('hides 追加学習 when non-local LLM is selected', () => {
      render(<AdvancedSection {...mockProps} />);
      expect(screen.queryByText('追加学習')).not.toBeInTheDocument();
    });
  });
});
