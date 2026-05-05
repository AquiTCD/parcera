import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Mock audio/visual to avoid overhead
vi.mock('../lib/audio', () => ({
  initAudioContext: vi.fn(),
  getContext: vi.fn(),
  getAnalyser: vi.fn(),
  connectToAnalyser: vi.fn(),
  setNoiseGateDb: vi.fn(),
  getExternalLipsync: vi.fn(() => null),
  setExternalLipsync: vi.fn(),
  clearExternalLipsync: vi.fn(),
}));

vi.mock('../lib/visual', () => ({
  initVisual: vi.fn(),
}));

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

import { Avatar } from '../components/Avatar';
import { api } from '../lib/api';
import { state } from '../lib/state';

describe('Sensitivity Controls in Avatar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (window as any).location;
    (window as any).location = new URL('http://localhost/?type=ai');

    // Manually force state because module-level initialization might have already happened
    state.avatarType = 'ai';
  });

  it('renders sensitivity buttons for AI avatar', async () => {
    vi.mocked(api.getSettings).mockResolvedValue({
      response_sensitivity: 'medium',
      avatars: { ai: { assets_dir: '/test' } },
      user_profile: { mode: 'soliloquy' }
    } as any);

    render(<Avatar />);

    await waitFor(() => {
      expect(screen.getByText('L')).toBeInTheDocument();
      expect(screen.getByText('M')).toBeInTheDocument();
      expect(screen.getByText('H')).toBeInTheDocument();
    });
  });

  it('calls updateSetting when a sensitivity button is clicked', async () => {
    vi.mocked(api.getSettings).mockResolvedValue({
      response_sensitivity: 'medium',
      avatars: { ai: { assets_dir: '/test' } },
      user_profile: { mode: 'soliloquy' }
    } as any);

    render(<Avatar />);

    await waitFor(() => {
      const highBtn = screen.getByText('H');
      fireEvent.click(highBtn);
    });

    expect(vi.mocked(api.updateSetting)).toHaveBeenCalledWith('response_sensitivity', 'high');
  });

  it('highlights the active sensitivity level', async () => {
    vi.mocked(api.getSettings).mockResolvedValueOnce({
      response_sensitivity: 'low',
      avatars: { ai: { assets_dir: '/test' } }
    } as any);

    render(<Avatar />);

    await waitFor(() => {
      const lowBtn = screen.getByText('L');
      expect(lowBtn).toHaveClass('active');

      const midBtn = screen.getByText('M');
      expect(midBtn).not.toHaveClass('active');
    });
  });
});
