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

import { DeveloperSection } from '../components/sections/DeveloperSection';

const dummySettings = {
  log_level: 'INFO',
  simple_log: false,
  profile_mode: false,
  verbose: false,
  app: {
    port: 8676,
    ai_audio_sample_rate: 16000,
    gpu_acceleration: true,
    windows: {},
  },
  avatars: {
    show_debug: false,
  },
};

const mockProps = {
  settings: dummySettings as any,
  defaultSettings: dummySettings as any,
  updateRoot: vi.fn(),
  updateNested: vi.fn(),
  updateProvider: vi.fn(),
  setStatus: vi.fn(),
};

describe('DeveloperSection', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('ログビューア', () => {
    it('renders log viewer heading', () => {
      render(<DeveloperSection {...mockProps} />);
      expect(screen.getByText('ログビューア')).toBeInTheDocument();
    });

    it('renders clear button', () => {
      render(<DeveloperSection {...mockProps} />);
      expect(screen.getByText(/クリア/)).toBeInTheDocument();
    });

    it('shows waiting message when no logs', async () => {
      render(<DeveloperSection {...mockProps} />);
      await waitFor(() => {
        expect(screen.getByText(/ログを待機中/)).toBeInTheDocument();
      });
    });
  });

  describe('ログ設定', () => {
    it('renders log settings heading', () => {
      render(<DeveloperSection {...mockProps} />);
      expect(screen.getByText('ログ設定')).toBeInTheDocument();
    });

    it('renders log level selector', () => {
      render(<DeveloperSection {...mockProps} />);
      expect(screen.getByText(/ログ出力レベル/)).toBeInTheDocument();
    });

    it('renders simple log mode toggle', () => {
      render(<DeveloperSection {...mockProps} />);
      expect(screen.getByText(/シンプルログモード/)).toBeInTheDocument();
    });

    it('renders performance log toggle', () => {
      render(<DeveloperSection {...mockProps} />);
      expect(screen.getByText(/パフォーマンス計測ログ/)).toBeInTheDocument();
    });
  });

  describe('システム設定', () => {
    it('renders system settings heading', () => {
      render(<DeveloperSection {...mockProps} />);
      expect(screen.getByText('システム設定')).toBeInTheDocument();
    });

    it('renders WebSocket port input', () => {
      render(<DeveloperSection {...mockProps} />);
      expect(screen.getByText(/WebSocketポート番号/)).toBeInTheDocument();
    });

    it('renders GPU acceleration toggle', () => {
      render(<DeveloperSection {...mockProps} />);
      expect(screen.getByText(/GPUアクセラレーション/)).toBeInTheDocument();
    });

    it('renders debug info display toggle (moved from VisualTab)', () => {
      render(<DeveloperSection {...mockProps} />);
      expect(screen.getByText(/デバッグ情報表示/)).toBeInTheDocument();
    });
  });
});
