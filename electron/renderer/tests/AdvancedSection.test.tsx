import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { AdvancedSection } from '../components/sections/AdvancedSection';

const mockElectron = {
  getSettings: vi.fn(),
  onSettingsChanged: vi.fn(() => vi.fn()),
  saveSettings: vi.fn(),
};
(window as any).electronAPI = mockElectron;

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
  electron: { port: 8676 },
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

  describe('追加学習', () => {
    it('renders 追加学習 heading', () => {
      render(<AdvancedSection {...mockProps} />);
      expect(screen.getByText('追加学習')).toBeInTheDocument();
    });
  });
});
