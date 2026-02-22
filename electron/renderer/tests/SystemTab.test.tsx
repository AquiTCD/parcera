import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { SystemTab } from '../components/settings/SystemTab';
import type { ParceraSettings } from '../../shared/types';

describe('SystemTab', () => {
  const mockUpdateNested = vi.fn();
  const mockUpdateRoot = vi.fn();

  const dummySettings: ParceraSettings = {
    log_level: 'INFO',
    profile_mode: false,
    electron: {
      port: 8676,
      ai_audio_sample_rate: 16000
    }
  } as any;

  const props = {
    settings: dummySettings,
    defaultSettings: dummySettings,
    updateNested: mockUpdateNested,
    updateRoot: mockUpdateRoot,
    updateProvider: vi.fn(),
    setStatus: vi.fn(),
    renderTabHeader: (title: string) => <h2>{title}</h2>
  };

  it('renders log level and profile mode settings', () => {
    render(<SystemTab {...props} />);

    expect(screen.getByText('デバッグ・ログ設定')).toBeInTheDocument();
    expect(screen.getByLabelText('ログ出力レベル')).toBeInTheDocument();
    expect(screen.getByLabelText('パフォーマンス計測ログを表示 ([PERF])')).toBeInTheDocument();
  });

  it('renders port and sample rate settings', () => {
    render(<SystemTab {...props} />);

    expect(screen.getByText('通信・基本設定')).toBeInTheDocument();
    expect(screen.getByLabelText('WebSocket ポート番号')).toBeInTheDocument();
    expect(screen.getByLabelText('内部音声サンプリングレート (Hz)')).toBeInTheDocument();
  });

  it('calls updateRoot when log level or profile mode changes', () => {
    render(<SystemTab {...props} />);

    const logLevelSelect = screen.getByLabelText('ログ出力レベル');
    fireEvent.change(logLevelSelect, { target: { value: 'DEBUG' } });
    expect(mockUpdateRoot).toHaveBeenCalledWith('log_level', 'DEBUG');

    const profileCheckbox = screen.getByLabelText('パフォーマンス計測ログを表示 ([PERF])');
    fireEvent.click(profileCheckbox);
    expect(mockUpdateRoot).toHaveBeenCalledWith('profile_mode', true);
  });

  it('calls updateNested when port or sample rate changes', () => {
    render(<SystemTab {...props} />);

    const portInput = screen.getByLabelText('WebSocket ポート番号');
    fireEvent.change(portInput, { target: { value: '9999' } });
    expect(mockUpdateNested).toHaveBeenCalledWith('electron', 'port', 9999);

    const sampleRateSelect = screen.getByLabelText('内部音声サンプリングレート (Hz)');
    fireEvent.change(sampleRateSelect, { target: { value: '44100' } });
    expect(mockUpdateNested).toHaveBeenCalledWith('electron', 'ai_audio_sample_rate', 44100);
  });
});
