import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { Avatar } from '@/components/Avatar';

// Mock Electron API
const mockElectron = {
  getSettings: vi.fn(),
  onSettingsChanged: vi.fn(() => vi.fn()),
  onAvatarSpeechStateChanged: vi.fn(() => vi.fn()),
  onAvatarBlink: vi.fn(() => vi.fn()),
  onAvatarLipSyncUpdate: vi.fn(() => vi.fn()),
  resolveLocalPath: vi.fn((p) => `file://${p}`),
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
});
