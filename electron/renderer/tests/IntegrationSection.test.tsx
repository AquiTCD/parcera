import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { IntegrationSection } from '../components/sections/IntegrationSection';
import { createBaseMockElectron } from './helpers/mockElectron';

const mockElectron = {
  ...createBaseMockElectron(),
  getTwitchStatus: vi.fn().mockResolvedValue({ session_id: null }),
  twitchGetAuthStatus: vi.fn().mockResolvedValue(false),
  twitchStartAuth: vi.fn().mockResolvedValue({}),
  twitchClearAuth: vi.fn().mockResolvedValue({}),
  onTwitchAuthStatus: vi.fn(() => vi.fn()),
};
(window as any).electronAPI = mockElectron;

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

describe('IntegrationSection', () => {
  beforeEach(() => vi.clearAllMocks());

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
      const localMock = {
        ...mockElectron,
        twitchGetAuthStatus: vi.fn().mockResolvedValue(true),
        getTwitchStatus: vi.fn().mockResolvedValue({ session_id: 'ses-123', initialized: true }),
        onTwitchAuthStatus: vi.fn((cb: (v: { success: boolean }) => void) => {
          cb({ success: true });
          return vi.fn();
        }),
        twitchTestEvent: vi.fn().mockResolvedValue({ success: true }),
      };
      (window as any).electronAPI = localMock;
      vi.clearAllMocks();
      (global.fetch as ReturnType<typeof vi.fn>).mockClear();

      render(<IntegrationSection {...mockProps} />);

      await waitFor(() => {
        const testBtns = screen.queryAllByText('テスト');
        expect(testBtns.length).toBeGreaterThan(0);
      });

      const [firstTestBtn] = screen.queryAllByText('テスト');
      firstTestBtn.click();

      await waitFor(() => {
        expect(localMock.twitchTestEvent).toHaveBeenCalledWith('follow');
      });
      expect(global.fetch).not.toHaveBeenCalledWith(
        expect.stringContaining('/twitch/test-event'),
        expect.anything()
      );

      // restore
      (window as any).electronAPI = mockElectron;
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
