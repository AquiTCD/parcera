import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { TTSTab } from '../components/settings/TTSTab';
import type { ParceraSettings } from '../../shared/types';
import { SWRConfig } from 'swr';

describe('TTSTab', () => {
  const mockUpdateNested = vi.fn();
  const mockUpdateProvider = vi.fn();
  const mockUpdateTTSSettings = vi.fn();
  const mockSetStatus = vi.fn();

  const dummySettings: ParceraSettings = {
    tts: {
      provider: 'aivisspeech',
      providers: {
        aivisspeech: {
          api_url: 'http://127.0.0.1:10101',
          engine_path: '',
          style_id: 1
        },
        voicevox: {
          api_url: 'http://127.0.0.1:50021'
        },
        google: {
          api_key: 'test-key',
          voice: 'ja-JP-Neural2-B'
        }
      },
      settings: {
        speedScale: 1.0,
        intonationScale: 1.0,
        pitchScale: 0.0,
        volumeScale: 1.0
      }
    },
    electron: { port: 8676 }
  } as any;

  const props = {
    settings: dummySettings,
    defaultSettings: dummySettings,
    updateNested: mockUpdateNested,
    updateProvider: mockUpdateProvider,
    updateTTSSettings: mockUpdateTTSSettings,
    updateRoot: vi.fn(),
    setStatus: mockSetStatus,
    renderTabHeader: (title: string) => <h2>{title}</h2>
  };

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ name: 'Aivis', styles: [{ id: 1, name: 'Normal' }] }]
    } as any);
  });

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      {children}
    </SWRConfig>
  );

  it('renders TTS provider selection and engine settings', () => {
    render(<TTSTab {...props} />, { wrapper: Wrapper });

    expect(screen.getByText('使用するTTSプロバイダ')).toBeInTheDocument();
    expect(screen.getByText('AivisSpeech エンジン設定')).toBeInTheDocument();
    expect(screen.getByLabelText('エンジンのAPI URL')).toBeInTheDocument();
  });

  it('renders common voice parameters for local engines', () => {
    render(<TTSTab {...props} />, { wrapper: Wrapper });

    expect(screen.getByText('共通音声パラメーター')).toBeInTheDocument();
    expect(screen.getByLabelText('話速 (Speed Scale)')).toBeInTheDocument();
  });

  it('calls updateNested when provider changes', () => {
    render(<TTSTab {...props} />, { wrapper: Wrapper });

    const providerSelect = screen.getByLabelText('使用するTTSプロバイダ');
    fireEvent.change(providerSelect, { target: { value: 'voicevox' } });
    expect(mockUpdateNested).toHaveBeenCalledWith('tts', 'provider', 'voicevox');
  });

  it('calls updateTTSSettings for voice parameters', () => {
    render(<TTSTab {...props} />, { wrapper: Wrapper });

    const speedInput = screen.getByLabelText('話速 (Speed Scale)');
    fireEvent.change(speedInput, { target: { value: '1.2' } });
    expect(mockUpdateTTSSettings).toHaveBeenCalledWith('speedScale', 1.2);
  });

  it('handles "Fetch Speakers" button click', async () => {
    render(<TTSTab {...props} />, { wrapper: Wrapper });

    const fetchButton = screen.getByText('キャラクターリストを取得');
    fireEvent.click(fetchButton);

    await waitFor(() => {
      // Should call local server endpoint
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/tts/speakers?provider=aivisspeech'));
      expect(mockSetStatus).toHaveBeenCalledWith(expect.objectContaining({ message: 'キャラクターリストを更新しました' }));
    });
  });
});
