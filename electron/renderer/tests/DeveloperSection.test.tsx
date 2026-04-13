import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { DeveloperSection } from '../components/sections/DeveloperSection';
import { createBaseMockElectron } from './helpers/mockElectron';

const mockElectron = { ...createBaseMockElectron() };
(window as any).electronAPI = mockElectron;

const dummySettings = {
  log_level: 'INFO',
  simple_log: false,
  profile_mode: false,
  verbose: false,
  electron: {
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
      expect(screen.getByText(/表示ログをクリア/)).toBeInTheDocument();
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
