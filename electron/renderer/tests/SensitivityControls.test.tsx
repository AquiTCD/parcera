import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { Avatar } from '../components/Avatar';

// Mock audio/visual to avoid overhead
vi.mock('../lib/audio', () => ({
  initAudioContext: vi.fn(),
  getContext: vi.fn(),
  getAnalyser: vi.fn(),
  connectToAnalyser: vi.fn(),
  setNoiseGateDb: vi.fn(),
}));

vi.mock('../lib/visual', () => ({
  initVisual: vi.fn(),
}));

// Mock Electron API
const mockElectron = {
  getSettings: vi.fn().mockResolvedValue({
    response_sensitivity: 'medium',
    avatars: { ai: { assets_dir: '/test' } },
    user_profile: { mode: 'soliloquy' }
  }),
  onSettingsChanged: vi.fn(() => vi.fn()),
  onAvatarSpeechStateChanged: vi.fn(() => vi.fn()),
  onAvatarBlink: vi.fn(() => vi.fn()),
  onAvatarLipSyncUpdate: vi.fn(() => vi.fn()),
  resolveLocalPath: vi.fn((p) => `file://${p}`),
  getWindowBounds: vi.fn(),
  setResizable: vi.fn(),
  saveSettings: vi.fn(),
  updateSetting: vi.fn().mockResolvedValue({ success: true }),
  getLogHistory: vi.fn().mockResolvedValue([]),
};
(window as any).electronAPI = mockElectron;

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
    render(<Avatar />);

    await waitFor(() => {
      expect(screen.getByText('L')).toBeInTheDocument();
      expect(screen.getByText('M')).toBeInTheDocument();
      expect(screen.getByText('H')).toBeInTheDocument();
    });
  });

  it('calls updateSetting when a sensitivity button is clicked', async () => {
    render(<Avatar />);

    await waitFor(() => {
      const highBtn = screen.getByText('H');
      fireEvent.click(highBtn);
    });

    expect(mockElectron.updateSetting).toHaveBeenCalledWith('response_sensitivity', 'high');
  });

  it('highlights the active sensitivity level', async () => {
    mockElectron.getSettings.mockResolvedValueOnce({
      response_sensitivity: 'low',
      avatars: { ai: { assets_dir: '/test' } }
    });

    render(<Avatar />);

    await waitFor(() => {
      const lowBtn = screen.getByText('L');
      expect(lowBtn).toHaveClass('active');

      const midBtn = screen.getByText('M');
      expect(midBtn).not.toHaveClass('active');
    });
  });
});
