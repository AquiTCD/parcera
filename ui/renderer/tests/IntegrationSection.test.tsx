import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

import { IntegrationSection } from '../components/sections/IntegrationSection';
import { api } from '../lib/api';

global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) } as any);

const dummySettings = {
  twitch: {
    enabled: true,
    client_id: 'test-client',
    client_secret: 'test-secret',
    wake_word: '!ai',
    ignored_users: ['Nightbot'],
    ng_words: ['spam'],
    react_to_follow: true,
    react_to_subscribe: true,
    react_to_raid: true,
    response_speed: 'natural',
    global_cooldown: 30,
    user_cooldown: 60,
    max_queue_size: 5,
    queue_expiry_seconds: 120,
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

describe('IntegrationSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getTwitchStatus).mockResolvedValue({ initialized: false, session_id: null } as any);
    vi.mocked(api.twitchGetAuthStatus).mockResolvedValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Twitch有効化', () => {
    it('renders Twitch連携 heading', () => {
      render(<IntegrationSection {...mockProps} />);
      expect(screen.getByText('Twitch')).toBeInTheDocument();
    });

    it('renders enable toggle', () => {
      render(<IntegrationSection {...mockProps} />);
      expect(screen.getByText(/Twitch連携を有効/)).toBeInTheDocument();
    });
  });

  describe('認証', () => {
    it('renders channel name input', () => {
      render(<IntegrationSection {...mockProps} />);
      expect(screen.getByText('Client ID')).toBeInTheDocument();
    });

    it('renders OAuth auth button area', () => {
      render(<IntegrationSection {...mockProps} />);
      expect(screen.getByText(/Twitchと連携を開始/)).toBeInTheDocument();
    });
  });

  describe('反応するイベント', () => {
    it('renders event checkboxes', () => {
      render(<IntegrationSection {...mockProps} />);
      expect(screen.getByText(/フォロー/)).toBeInTheDocument();
    });

    it('テストボタンクリックで api.twitchTestEvent を呼び fetch は使わない', async () => {
      // Setup: authorized + session active → テストボタンが表示される
      vi.mocked(api.twitchGetAuthStatus).mockResolvedValue(true);
      vi.mocked(api.getTwitchStatus).mockResolvedValue({ session_id: 'ses-123', initialized: true });
      vi.mocked(api.onTwitchAuthStatus).mockImplementation((cb: any) => { cb({ success: true }); return vi.fn(); });
      vi.mocked(api.twitchTestEvent).mockResolvedValue({ success: true });
      (global.fetch as ReturnType<typeof vi.fn>).mockClear();

      render(<IntegrationSection {...mockProps} />);

      await waitFor(() => {
        const testBtns = screen.queryAllByText('テスト');
        expect(testBtns.length).toBeGreaterThan(0);
      });

      const [firstTestBtn] = screen.queryAllByText('テスト');
      firstTestBtn.click();

      await waitFor(() => {
        expect(vi.mocked(api.twitchTestEvent)).toHaveBeenCalledWith('follow');
      });
      expect(global.fetch).not.toHaveBeenCalledWith(
        expect.stringContaining('/twitch/test-event'),
        expect.anything()
      );
    });
  });

  describe('フィルター', () => {
    it('renders Wake Word input', () => {
      render(<IntegrationSection {...mockProps} />);
      expect(screen.getByText(/Wake Word/)).toBeInTheDocument();
    });

    it('renders ignored users input', () => {
      render(<IntegrationSection {...mockProps} />);
      expect(screen.getByText(/無視するユーザー/)).toBeInTheDocument();
    });

    it('renders NG words input', () => {
      render(<IntegrationSection {...mockProps} />);
      expect(screen.getByText(/NGワード/)).toBeInTheDocument();
    });
  });

  describe('詳細エリア（格下げカード）', () => {
    it('renders cooldown settings in a visually demoted area', () => {
      render(<IntegrationSection {...mockProps} />);
      expect(screen.getByText(/同一ユーザーのクールダウン/)).toBeInTheDocument();
    });

    it('renders queue size setting', () => {
      render(<IntegrationSection {...mockProps} />);
      expect(screen.getByText(/キューの最大数/)).toBeInTheDocument();
    });

    it('renders expiry setting', () => {
      render(<IntegrationSection {...mockProps} />);
      expect(screen.getByText(/有効期限/)).toBeInTheDocument();
    });
  });
});
