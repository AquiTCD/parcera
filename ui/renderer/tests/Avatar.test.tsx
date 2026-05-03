import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Mock MediaDevices
const mockGetUserMedia = vi.fn().mockResolvedValue({
  getAudioTracks: () => [{ stop: vi.fn(), enabled: true }]
});

const mockMediaDevices = {
  getUserMedia: mockGetUserMedia,
  enumerateDevices: vi.fn().mockResolvedValue([]),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};
vi.stubGlobal('navigator', { ...navigator, mediaDevices: mockMediaDevices });

vi.mock('../lib/audio', () => ({
  initAudioContext: vi.fn(),
  getContext: vi.fn(() => ({
    state: 'suspended',
    resume: vi.fn().mockResolvedValue(undefined),
    createAnalyser: vi.fn(() => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
      fftSize: 2048,
    })),
    createMediaStreamSource: vi.fn(() => ({ connect: vi.fn() })),
    createGain: vi.fn(() => ({ gain: { value: 1 }, connect: vi.fn() })),
    destination: {},
    sampleRate: 44100,
  })),
  getAnalyser: vi.fn(() => ({})),
  connectToAnalyser: vi.fn(),
  setNoiseGateDb: vi.fn(),
  getEnvelope: vi.fn(() => 0),
  getRMS: vi.fn(() => 0),
  getVowel: vi.fn(() => null),
  TALK_THRESHOLD: 0.05,
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

import { Avatar } from '@/components/Avatar';
import { api } from '@/lib/api';

describe('Avatar Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing and shows image', async () => {
    vi.mocked(api.getSettings).mockResolvedValue({
      avatars: {
        user: { name: 'TestUser', assets_dir: '/test/path' }
      }
    } as any);

    // We need to match the URL param 'type=user'
    delete (window as any).location;
    (window as any).location = new URL('http://localhost/?type=user');

    render(<Avatar />);

    await waitFor(() => {
      const img = screen.getByRole('img', { hidden: true });
      expect(img).toBeInTheDocument();
      expect(img).toHaveClass('avatar-main');
    });
  });

  it('updates opacity on error', async () => {
    vi.mocked(api.getSettings).mockResolvedValue({ avatars: {} } as any);
    const { container } = render(<Avatar />);

    const img = container.querySelector('img');
    if (!img) throw new Error('Img not found');

    // Simulate image load error
    fireEvent.error(img);

    // Check if opacity is reduced (CSS is applied via class or style, we check style if set)
    expect(img.style.opacity).toBe('0.5');
  });

  it('does not set data-tauri-drag-region when platform is electron', async () => {
    vi.mocked(api.getSettings).mockResolvedValue({ avatars: {} } as any);
    render(<Avatar />);
    const container = screen.getByTestId('avatar-container');
    expect(container).not.toHaveAttribute('data-tauri-drag-region');
  });

  it('handles visibility toggle', async () => {
    vi.mocked(api.getSettings).mockResolvedValue({ avatars: {} } as any);
    render(<Avatar />);

    // Simulate press 'v' (visibility toggle)
    fireEvent.keyDown(window, { key: 'v' });

    // The main container should have hidden class
    const avatar = screen.getByTestId('avatar-container');
    expect(avatar).toHaveClass('hidden');

    fireEvent.keyDown(window, { key: 'v' });
    expect(avatar).not.toHaveClass('hidden');
  });

  it('handles window lock with resizability and bounds saving', async () => {
    vi.mocked(api.getSettings).mockResolvedValue({
      app: { windows: { user: { locked: false } } }
    } as any);
    vi.mocked(api.getWindowBounds).mockResolvedValue({ x: 10, y: 20, width: 300, height: 400 });

    delete (window as any).location;
    (window as any).location = new URL('http://localhost/?type=user');

    render(<Avatar />);

    // Wait for component to settle with settings loaded, then click lock
    await waitFor(() => expect(screen.getByTestId('lock-button')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('lock-button'));

    // setResizable(false) is driven by the isLocked useEffect — wait for it
    await waitFor(() => {
      expect(vi.mocked(api.setResizable)).toHaveBeenCalledWith(false);
    });
    // Must not be called more than once with false for a single lock transition
    const falseCallCount = (vi.mocked(api.setResizable)).mock.calls.filter(
      ([v]) => v === false
    ).length;
    expect(falseCallCount).toBe(1);

    // Check if saveSettings was called with current bounds
    expect(vi.mocked(api.saveSettings)).toHaveBeenCalledWith(expect.objectContaining({
      app: expect.objectContaining({
        windows: expect.objectContaining({
          user: expect.objectContaining({
            locked: true,
            x: 10,
            y: 20,
            width: 300,
            height: 400
          })
        })
      })
    }));
  });

  it('requests specific microphone device when configured', async () => {
    vi.mocked(api.getSettings).mockResolvedValue({
      app: { mic_device_id: 'special-mic' },
      avatars: { user: { assets_dir: '/test' } }
    } as any);

    delete (window as any).location;
    (window as any).location = new URL('http://localhost/?type=user');

    render(<Avatar />);

    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalledWith(expect.objectContaining({
        audio: expect.objectContaining({
          deviceId: { exact: 'special-mic' }
        })
      }));
    });
  });

  it('uses default microphone when no specific id is set', async () => {
    vi.mocked(api.getSettings).mockResolvedValue({
      app: { mic_device_id: 'default' },
      avatars: { user: { assets_dir: '/test' } }
    } as any);

    delete (window as any).location;
    (window as any).location = new URL('http://localhost/?type=user');

    render(<Avatar />);

    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalledWith(expect.objectContaining({
        audio: expect.not.objectContaining({
          deviceId: expect.anything()
        })
      }));
    });
  });
});
