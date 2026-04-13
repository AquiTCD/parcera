import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { CharacterSection } from '../components/sections/CharacterSection';
import { createBaseMockElectron } from './helpers/mockElectron';

const mockElectron = { ...createBaseMockElectron() };
(window as any).electronAPI = mockElectron;

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => [],
} as any);

const dummySettings = {
  ai_profile: {
    name: 'テストAI',
    species: 'エルフ',
    gender: '女性',
    personality: '明るい',
    tone: 'フランク',
    first_person: '私',
    hobbies: '読書',
  },
  user_profile: {
    name: 'テストユーザー',
    calling: 'さん',
    gender: '男性',
    mode: 'conversation',
  },
  knowledge: 'テスト知識',
  llm: {
    provider: 'gemini',
    providers: { gemini: { temperature: 0.8 } },
  },
  tts: {
    provider: 'aivisspeech',
    settings: { speedScale: 1.0, intonationScale: 1.0, pitchScale: 0, volumeScale: 1.0 },
    providers: { aivisspeech: {} },
  },
  avatars: {
    ai: { assets_dir: '/path/to/ai' },
    user: { assets_dir: '/path/to/user' },
  },
  electron: { port: 8676, windows: { ai: {}, user: {} } },
};

const mockProps = {
  settings: dummySettings as any,
  defaultSettings: dummySettings as any,
  updateRoot: vi.fn(),
  updateNested: vi.fn(),
  updateProvider: vi.fn(),
  updateTTSSettings: vi.fn(),
  setStatus: vi.fn(),
  handleSelectDir: vi.fn(),
};

describe('CharacterSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('性格・プロフィール', () => {
    it('renders the personality profile heading', () => {
      render(<CharacterSection {...mockProps} />);
      expect(screen.getByText('性格・プロフィール')).toBeInTheDocument();
    });

    it('renders name field with value', () => {
      render(<CharacterSection {...mockProps} />);
      const nameInput = screen.getByDisplayValue('テストAI');
      expect(nameInput).toBeInTheDocument();
    });

    it('renders 種族 and 性別 in 2-column layout', () => {
      render(<CharacterSection {...mockProps} />);
      expect(screen.getByDisplayValue('エルフ')).toBeInTheDocument();
      expect(screen.getByDisplayValue('女性')).toBeInTheDocument();
    });

    it('renders 一人称 and 趣味 in 2-column layout', () => {
      render(<CharacterSection {...mockProps} />);
      expect(screen.getByDisplayValue('私')).toBeInTheDocument();
      expect(screen.getByDisplayValue('読書')).toBeInTheDocument();
    });
  });

  describe('追加知識・シチュエーション', () => {
    it('renders the knowledge heading', () => {
      render(<CharacterSection {...mockProps} />);
      expect(screen.getByText('追加知識・シチュエーション')).toBeInTheDocument();
    });

    it('shows knowledge textarea with value', () => {
      render(<CharacterSection {...mockProps} />);
      expect(screen.getByDisplayValue('テスト知識')).toBeInTheDocument();
    });

    it('calls updateRoot when knowledge changes', () => {
      render(<CharacterSection {...mockProps} />);
      const textarea = screen.getByDisplayValue('テスト知識');
      fireEvent.change(textarea, { target: { value: '新しい知識' } });
      expect(mockProps.updateRoot).toHaveBeenCalledWith('knowledge', '新しい知識');
    });
  });

  describe('ユーザー設定', () => {
    it('renders the user settings heading', () => {
      render(<CharacterSection {...mockProps} />);
      expect(screen.getByText('ユーザー設定')).toBeInTheDocument();
    });

    it('renders user name and calling fields', () => {
      render(<CharacterSection {...mockProps} />);
      expect(screen.getByDisplayValue('テストユーザー')).toBeInTheDocument();
    });
  });

  describe('返答スタイル', () => {
    it('renders the response style heading', () => {
      render(<CharacterSection {...mockProps} />);
      expect(screen.getByText('返答スタイル')).toBeInTheDocument();
    });

    it('renders Temperature slider', () => {
      render(<CharacterSection {...mockProps} />);
      expect(screen.getByText('Temperature')).toBeInTheDocument();
    });
  });

  describe('声 (TTS)', () => {
    it('renders the voice section heading', () => {
      render(<CharacterSection {...mockProps} />);
      expect(screen.getByText('声')).toBeInTheDocument();
    });

    it('renders TTS provider selector', () => {
      render(<CharacterSection {...mockProps} />);
      expect(screen.getByText('TTSプロバイダー')).toBeInTheDocument();
    });

    it('does NOT render TTS connection URL in CharacterSection', () => {
      render(<CharacterSection {...mockProps} />);
      expect(screen.queryByText(/エンジンのAPI URL/)).not.toBeInTheDocument();
      expect(screen.queryByText(/エンジン起動パス/)).not.toBeInTheDocument();
    });
  });

  describe('見た目', () => {
    it('renders the appearance section heading', () => {
      render(<CharacterSection {...mockProps} />);
      expect(screen.getByText('見た目')).toBeInTheDocument();
    });

    it('renders avatar path labels', () => {
      render(<CharacterSection {...mockProps} />);
      expect(screen.getByText(/AIアバター/)).toBeInTheDocument();
    });
  });
});
