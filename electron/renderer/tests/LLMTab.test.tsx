import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { LLMTab } from '../components/settings/LLMTab';
import type { ParceraSettings } from '../../shared/types';
import { SWRConfig } from 'swr';

describe('LLMTab', () => {
  const mockUpdateNested = vi.fn();
  const mockUpdateProvider = vi.fn();
  const mockSetStatus = vi.fn();

  const dummySettings: ParceraSettings = {
    llm: {
      provider: 'gemini',
      providers: {
        gemini: {
          api_key: 'test-key',
          model: 'gemini-1.5-pro',
          temperature: 1.0,
          option_split_threshold: 15,
          persist_history: false
        },
        openai: {
          api_key: '',
          model: '',
          temperature: 1.0
        }
      }
    }
  } as any;

  const props = {
    settings: dummySettings,
    defaultSettings: dummySettings,
    updateNested: mockUpdateNested,
    updateProvider: mockUpdateProvider,
    updateRoot: vi.fn(),
    setStatus: mockSetStatus,
    renderTabHeader: (title: string) => <h2>{title}</h2>
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock fetch for model fetching
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ models: [{ name: 'models/gemini-1.5-pro' }] })
    } as any);
  });

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      {children}
    </SWRConfig>
  );

  it('renders provider selection and current provider settings', () => {
    render(<LLMTab {...props} />, { wrapper: Wrapper });

    expect(screen.getByText('使用するプロバイダ')).toBeInTheDocument();
    expect(screen.getByText('gemini の設定')).toBeInTheDocument();
    expect(screen.getByLabelText('1. APIキー (必須)')).toBeInTheDocument();
  });

  it('changes provider when select is changed', () => {
    render(<LLMTab {...props} />, { wrapper: Wrapper });

    const providerSelect = screen.getByLabelText('使用するプロバイダ');
    fireEvent.change(providerSelect, { target: { value: 'openai' } });
    expect(mockUpdateNested).toHaveBeenCalledWith('llm', 'provider', 'openai');
  });

  it('calls updateProvider when API key changes', () => {
    render(<LLMTab {...props} />, { wrapper: Wrapper });

    const apiKeyInput = screen.getByPlaceholderText('API Key');
    fireEvent.change(apiKeyInput, { target: { value: 'new-key' } });
    expect(mockUpdateProvider).toHaveBeenCalledWith('llm', 'gemini', 'api_key', 'new-key');
  });

  it('calls updateProvider for temperature and split threshold', () => {
    render(<LLMTab {...props} />, { wrapper: Wrapper });

    const tempInput = screen.getByLabelText('表現のランダム性 (Temperature)');
    fireEvent.change(tempInput, { target: { value: '0.5' } });
    expect(mockUpdateProvider).toHaveBeenCalledWith('llm', 'gemini', 'temperature', 0.5);

    const splitInput = screen.getByLabelText('文章の分割文字数 (ストリーミング)');
    fireEvent.change(splitInput, { target: { value: '20' } });
    expect(mockUpdateProvider).toHaveBeenCalledWith('llm', 'gemini', 'option_split_threshold', 20);
  });

  it('successfully fetches and displays models when fetch button is clicked', async () => {
    render(<LLMTab {...props} />, { wrapper: Wrapper });

    const fetchButton = screen.getByText('APIキーを使ってモデル一覧を取得する');
    fireEvent.click(fetchButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
      expect(screen.getByText('gemini-1.5-pro')).toBeInTheDocument();
    });
  });

  it('handles API fetch failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403
    } as any);

    render(<LLMTab {...props} />, { wrapper: Wrapper });

    const fetchButton = screen.getByText('APIキーを使ってモデル一覧を取得する');
    fireEvent.click(fetchButton);

    await waitFor(() => {
      expect(mockSetStatus).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
    });
  });
});
