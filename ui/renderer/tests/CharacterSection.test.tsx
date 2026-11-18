import '@testing-library/jest-dom';
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

import { CharacterSection } from '../components/sections/CharacterSection';

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
  app: { port: 8676, windows: { ai: {}, user: {} } },
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

    it('switches knowledge and active_knowledge_preset_id when selecting a preset', () => {
      const presetSettings = {
        ...dummySettings,
        knowledge: 'スト6の知識',
        active_knowledge_preset_id: 'sf6',
        knowledge_presets: [
          { id: 'sf6', title: 'スト6配信', content: 'スト6の知識' },
          { id: 'gta', title: 'GTA配信', content: 'GTAの知識' },
        ],
      };
      render(<CharacterSection {...mockProps} settings={presetSettings as any} />);

      const trigger = screen.getByRole('combobox', { name: '知識プリセット' });
      fireEvent.click(trigger);
      fireEvent.click(screen.getByRole('option', { name: 'GTA配信' }));

      expect(mockProps.updateRoot).toHaveBeenCalledWith('active_knowledge_preset_id', 'gta');
      expect(mockProps.updateRoot).toHaveBeenCalledWith('knowledge', 'GTAの知識');
    });

    it('saves a new knowledge preset with title and current knowledge', () => {
      const presetSettings = {
        ...dummySettings,
        knowledge: '新規ゲーム知識',
        active_knowledge_preset_id: '',
        knowledge_presets: [],
      };
      render(<CharacterSection {...mockProps} settings={presetSettings as any} />);

      const titleInput = screen.getByPlaceholderText('プリセット名（例: スト6配信）');
      fireEvent.change(titleInput, { target: { value: 'スト6配信' } });
      fireEvent.click(screen.getByRole('button', { name: '新規保存' }));

      expect(mockProps.updateRoot).toHaveBeenCalledWith(
        'knowledge_presets',
        [expect.objectContaining({ title: 'スト6配信', content: '新規ゲーム知識' })]
      );
      expect(mockProps.updateRoot).toHaveBeenCalledWith(
        'active_knowledge_preset_id',
        expect.any(String)
      );
    });

    it('updates and deletes the active knowledge preset', () => {
      const presetSettings = {
        ...dummySettings,
        knowledge: '編集後のスト6知識',
        active_knowledge_preset_id: 'sf6',
        knowledge_presets: [
          { id: 'sf6', title: 'スト6配信', content: '古いスト6知識' },
          { id: 'gta', title: 'GTA配信', content: 'GTAの知識' },
        ],
      };
      render(<CharacterSection {...mockProps} settings={presetSettings as any} />);

      fireEvent.click(screen.getByRole('button', { name: '上書き保存' }));
      expect(mockProps.updateRoot).toHaveBeenCalledWith('knowledge_presets', [
        { id: 'sf6', title: 'スト6配信', content: '編集後のスト6知識' },
        { id: 'gta', title: 'GTA配信', content: 'GTAの知識' },
      ]);

      vi.clearAllMocks();
      fireEvent.click(screen.getByRole('button', { name: '削除' }));
      expect(mockProps.updateRoot).toHaveBeenCalledWith('knowledge_presets', [
        { id: 'gta', title: 'GTA配信', content: 'GTAの知識' },
      ]);
      expect(mockProps.updateRoot).toHaveBeenCalledWith('active_knowledge_preset_id', '');
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
