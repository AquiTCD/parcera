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

import { Avatar } from '@/components/Avatar';

// Mock Electron API
const mockElectron = {
  getSettings: vi.fn(),
  onSettingsChanged: vi.fn(() => vi.fn()),
  onAvatarSpeechStateChanged: vi.fn(() => vi.fn()),
  onAvatarBlink: vi.fn(() => vi.fn()),
  onAvatarLipSyncUpdate: vi.fn(() => vi.fn()),
  resolveLocalPath: vi.fn((p) => `file://${p}`),
  getWindowBounds: vi.fn(),
  setResizable: vi.fn(),
  saveSettings: vi.fn(),
  getLogHistory: vi.fn().mockResolvedValue([]),
};
(window as any).electronAPI = mockElectron;


describe('Avatar Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing and shows image', async () => {
    mockElectron.getSettings.mockResolvedValue({
      avatars: {
        user: { name: 'TestUser', assets_dir: '/test/path' }
      }
    });

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
    mockElectron.getSettings.mockResolvedValue({ avatars: {} });
    const { container } = render(<Avatar />);

    const img = container.querySelector('img');
    if (!img) throw new Error('Img not found');

    // Simulate image load error
    fireEvent.error(img);

    // Check if opacity is reduced (CSS is applied via class or style, we check style if set)
    expect(img.style.opacity).toBe('0.5');
  });

  it('does not set data-tauri-drag-region when platform is electron', async () => {
    mockElectron.getSettings.mockResolvedValue({ avatars: {} });
    render(<Avatar />);
    const container = screen.getByTestId('avatar-container');
    expect(container).not.toHaveAttribute('data-tauri-drag-region');
  });

  it('handles visibility toggle', async () => {
    mockElectron.getSettings.mockResolvedValue({ avatars: {} });
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
    mockElectron.getSettings.mockResolvedValue({
      electron: { windows: { user: { locked: false } } }
    });
    mockElectron.getWindowBounds = vi.fn().mockResolvedValue({ x: 10, y: 20, width: 300, height: 400 });
    mockElectron.setResizable = vi.fn();
    mockElectron.saveSettings = vi.fn();

    delete (window as any).location;
    (window as any).location = new URL('http://localhost/?type=user');

    render(<Avatar />);

    // Wait for component to settle with settings loaded, then click lock
    await waitFor(() => expect(screen.getByTestId('lock-button')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('lock-button'));

    // setResizable(false) is driven by the isLocked useEffect — wait for it
    await waitFor(() => {
      expect(mockElectron.setResizable).toHaveBeenCalledWith(false);
    });
    // Must not be called more than once with false for a single lock transition
    const falseCallCount = (mockElectron.setResizable as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([v]) => v === false
    ).length;
    expect(falseCallCount).toBe(1);

    // Check if saveSettings was called with current bounds
    expect(mockElectron.saveSettings).toHaveBeenCalledWith(expect.objectContaining({
      electron: expect.objectContaining({
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
    mockElectron.getSettings.mockResolvedValue({
      electron: { mic_device_id: 'special-mic' },
      avatars: { user: { assets_dir: '/test' } }
    });

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
    mockElectron.getSettings.mockResolvedValue({
      electron: { mic_device_id: 'default' },
      avatars: { user: { assets_dir: '/test' } }
    });

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
