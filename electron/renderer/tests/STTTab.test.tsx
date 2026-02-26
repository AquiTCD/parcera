import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { STTTab } from '../components/settings/STTTab';
import type { ParceraSettings } from '../../shared/types';

// Mock fetch for model check
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ cached: true })
});

// Mock electronAPI.checkModelCached
(window as any).electronAPI = {
  checkModelCached: vi.fn().mockResolvedValue(true),
  downloadModel: vi.fn(),
  reloadModel: vi.fn(),
};

// Mock MediaDevices
const mockEnumerateDevices = vi.fn().mockResolvedValue([
  { kind: 'audioinput', deviceId: 'mic1', label: 'Mic 1' },
  { kind: 'audioinput', deviceId: 'mic2', label: 'Mic 2' },
]);

Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    enumerateDevices: mockEnumerateDevices,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  },
  configurable: true,
});

describe('STTTab', () => {
  const mockUpdateNested = vi.fn();
  const mockUpdateRoot = vi.fn();
  const mockUpdateProvider = vi.fn();

  const dummySettings: ParceraSettings = {
    stt: {
      provider: 'faster_whisper',
      providers: {
        faster_whisper: {
          model: 'base',
          device: 'auto',
          compute_type: 'default',
          whisper_vad_filter: false
        }
      },
      dictionary: {
        specific_keywords: ['word1', 'word2']
      },
      ignore_sentences: ['ignore1']
    },
    vad: {
      start_muted: false,
      volume_db_threshold: -20,
      silence_duration_threshold: 0.5,
      max_duration: 30
    },
    force_keywords: ['force1'],
    response_sensitivity: 'medium',
    merge_request_threshold: 1.0
  } as any;

  const props = {
    settings: dummySettings,
    defaultSettings: dummySettings,
    updateNested: mockUpdateNested,
    updateRoot: mockUpdateRoot,
    updateProvider: mockUpdateProvider,
    setStatus: vi.fn(),
    renderTabHeader: (title: string) => <h2>{title}</h2>
  };

  it('renders VAD and sensitivity settings', () => {
    render(<STTTab {...props} />);

    expect(screen.getByText('VAD設定 (声の検出)')).toBeInTheDocument();
    expect(screen.getByLabelText('起動時にマイクをミュートにする')).toBeInTheDocument();
    expect(screen.getByText(/音声検出の音量閾値/)).toBeInTheDocument();
    expect(screen.getByLabelText('発話終了判定の無音時間 (秒)')).toBeInTheDocument();
  });

  it('renders and updates the microphone list', async () => {
    render(<STTTab {...props} />);

    expect(screen.getByText('使用するマイク')).toBeInTheDocument();

    // Wait for devices to be fetched
    await waitFor(() => {
      const select = screen.getByLabelText('使用するマイク');
      expect(select).toBeInTheDocument();
    });

    const select = screen.getByLabelText('使用するマイク');
    fireEvent.change(select, { target: { value: 'mic1' } });
    expect(mockUpdateNested).toHaveBeenCalledWith('electron', 'mic_device_id', 'mic1');
  });

  it('renders interruption and dictionary settings', async () => {
    render(<STTTab {...props} />);

    expect(screen.getByLabelText('強制応答キーワード')).toBeInTheDocument();
    expect(screen.getByLabelText('無視するフレーズ')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByLabelText('Whisper 認識強化辞書')).toBeInTheDocument();
    });
  });

  it('calls updateNested when VAD settings change', () => {
    render(<STTTab {...props} />);

    const muteCheckbox = screen.getByLabelText('起動時にマイクをミュートにする');
    fireEvent.click(muteCheckbox);
    expect(mockUpdateNested).toHaveBeenCalledWith('vad', 'start_muted', true);

    const silenceInput = screen.getByLabelText('発話終了判定の無音時間 (秒)');
    fireEvent.change(silenceInput, { target: { value: '0.8' } });
    expect(mockUpdateNested).toHaveBeenCalledWith('vad', 'silence_duration_threshold', 0.8);
  });

  it('calls updateRoot when force keywords or sensitivity change', () => {
    render(<STTTab {...props} />);

    const forceKeywordsInput = screen.getByLabelText('強制応答キーワード');
    fireEvent.change(forceKeywordsInput, { target: { value: 'kw1, kw2' } });
    expect(mockUpdateRoot).toHaveBeenCalledWith('force_keywords', ['kw1', 'kw2']);

    const sensitivitySelect = screen.getByLabelText('応答頻度');
    fireEvent.change(sensitivitySelect, { target: { value: 'high' } });
    expect(mockUpdateRoot).toHaveBeenCalledWith('response_sensitivity', 'high');
  });

  it('switches between STT providers and shows provider-specific settings', () => {
    const { rerender } = render(<STTTab {...props} />);
    expect(screen.getByText('Faster Whisper 設定')).toBeInTheDocument();

    const azureSettings = {
      ...dummySettings,
      stt: { ...dummySettings.stt, provider: 'azure' }
    } as any;

    rerender(<STTTab {...props} settings={azureSettings} />);
    expect(screen.getByText('Azure STT 設定')).toBeInTheDocument();
  });
});
