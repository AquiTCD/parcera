import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import React from 'react';
import { TwitchTab } from '../components/settings/TwitchTab';
import type { ParceraSettings } from '../../shared/types';

describe('TwitchTab', () => {
  const mockUpdateNested = vi.fn();
  const mockSetStatus = vi.fn();
  const mockTwitchStartAuth = vi.fn();
  const mockTwitchGetAuthStatus = vi.fn().mockResolvedValue(false);
  const mockTwitchClearAuth = vi.fn();
  const mockOnTwitchAuthStatus = vi.fn().mockReturnValue(vi.fn());

  const dummySettings: ParceraSettings = {
    twitch: {
      enabled: false,
      client_id: 'test_client_id',
      client_secret: 'test_client_secret',
      wake_word: 'テスト',
      ignored_users: ['Bot1']
    }
  } as any;

  const props = {
    settings: dummySettings,
    updateNested: mockUpdateNested,
    setStatus: mockSetStatus,
    renderTabHeader: (title: string) => <h2>{title}</h2>,
    updateRoot: vi.fn(),
    updateProvider: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).electronAPI = {
      twitchStartAuth: mockTwitchStartAuth,
      twitchGetAuthStatus: mockTwitchGetAuthStatus,
      twitchClearAuth: mockTwitchClearAuth,
      onTwitchAuthStatus: mockOnTwitchAuthStatus,
    };
  });

  it('renders correctly with settings', async () => {
    await act(async () => {
      render(<TwitchTab {...props} />);
    });

    expect(screen.getByText('Twitch連携')).toBeInTheDocument();
    expect(screen.getByLabelText(/Twitch連携を有効にする/)).toBeInTheDocument();
    expect(screen.getByDisplayValue('test_client_id')).toBeInTheDocument();
    expect(screen.getByDisplayValue('test_client_secret')).toBeInTheDocument();
    expect(screen.getByDisplayValue('テスト')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Bot1')).toBeInTheDocument();
  });

  it('starts auth when button is clicked', async () => {
    await act(async () => {
      render(<TwitchTab {...props} />);
    });

    const authButton = screen.getByText('Twitchと連携を開始');
    await act(async () => {
      fireEvent.click(authButton);
    });

    expect(mockTwitchStartAuth).toHaveBeenCalled();
    await waitFor(() => {
      expect(mockSetStatus).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('ブラウザ'),
        type: 'success'
      }));
    });
  });

  it('calls updateNested when settings change', async () => {
    await act(async () => {
      render(<TwitchTab {...props} />);
    });

    const enabledSwitch = screen.getByLabelText(/Twitch連携を有効にする/);
    fireEvent.click(enabledSwitch);
    expect(mockUpdateNested).toHaveBeenCalledWith('twitch', 'enabled', true);

    const clientIdInput = screen.getByLabelText('Client ID');
    fireEvent.change(clientIdInput, { target: { value: 'new_id' } });
    expect(mockUpdateNested).toHaveBeenCalledWith('twitch', 'client_id', 'new_id');

    const wakeWordInput = screen.getByLabelText('Wake Word (正規表現)');
    fireEvent.change(wakeWordInput, { target: { value: 'ハロー' } });
    expect(mockUpdateNested).toHaveBeenCalledWith('twitch', 'wake_word', 'ハロー');

    const speedSelect = screen.getByLabelText('反応までの待ち時間');
    fireEvent.change(speedSelect, { target: { value: 'fast' } });
    expect(mockUpdateNested).toHaveBeenCalledWith('twitch', 'response_speed', 'fast');
  });

  it('shows authorized status when authenticated', async () => {
    mockTwitchGetAuthStatus.mockResolvedValueOnce(true);

    await act(async () => {
      render(<TwitchTab {...props} />);
    });

    const label = await screen.findByText('認証済み');
    expect(label).toBeInTheDocument();
    expect(screen.getByText('連携を解除')).toBeInTheDocument();
  });

  it('clears auth when disconnect button is clicked', async () => {
    mockTwitchGetAuthStatus.mockResolvedValueOnce(true);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await act(async () => {
      render(<TwitchTab {...props} />);
    });

    const clearButton = await screen.findByText('連携を解除');
    await act(async () => {
      fireEvent.click(clearButton);
    });

    expect(window.confirm).toHaveBeenCalled();
    expect(mockTwitchClearAuth).toHaveBeenCalled();
    await waitFor(() => {
      expect(mockSetStatus).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('削除'),
        type: 'success'
      }));
    });
  });
});
