import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import React from 'react';
import { VisualTab } from '../components/settings/VisualTab';
import type { ParceraSettings } from '../../shared/types';

describe('VisualTab', () => {
  const mockUpdateNested = vi.fn();
  const mockUpdateProvider = vi.fn();
  const mockUpdateRoot = vi.fn();
  const mockSetStatus = vi.fn();

  const dummySettings: ParceraSettings = {
    avatars: {
      user: {
        assets_dir: '/path/to/user',
        flip_horizontal: false,
        chroma_key_enabled: true,
        chroma_key_color: 'green'
      },
      ai: {
        assets_dir: '/path/to/ai',
        flip_horizontal: true,
        chroma_key_enabled: true,
        chroma_key_color: 'blue'
      },
      show_debug: false,
      breathe_scale: 1.0,
      breathe_amplitude: 5.0,
      breathe_duration: 3000
    }
  } as any;

  const props = {
    settings: dummySettings,
    defaultSettings: dummySettings,
    updateNested: mockUpdateNested,
    updateProvider: mockUpdateProvider,
    updateRoot: mockUpdateRoot,
    setStatus: mockSetStatus,
    renderTabHeader: (title: string) => <h2>{title}</h2>
  };

  it('renders avatar path settings', () => {
    render(<VisualTab {...props} />);

    expect(screen.getByLabelText('USERアバター パス')).toBeInTheDocument();
    expect(screen.getByLabelText('AIアバター パス')).toBeInTheDocument();
  });

  it('calls updateNested when flipping/chromakey checkboxes change', () => {
    render(<VisualTab {...props} />);

    // Scoped query for User section via data-testid
    const userCol = screen.getByTestId('avatar-column-user');
    const flipSwitch = within(userCol).getByRole('switch', { name: '左右反転する' });

    fireEvent.click(flipSwitch);
    expect(mockUpdateNested).toHaveBeenCalledWith('avatars', 'user', expect.objectContaining({ flip_horizontal: true }));
  });

  it('renders window dimension settings via WindowSettingsSection', () => {
    render(<VisualTab {...props} />);

    expect(screen.getByText('USERウィンドウ')).toBeInTheDocument();
    expect(screen.getByText('AIウィンドウ')).toBeInTheDocument();
  });

  it('calls updateNested when breathing settings change', () => {
    render(<VisualTab {...props} />);

    const scaleInput = screen.getByLabelText('呼吸のスケーリング幅');
    fireEvent.change(scaleInput, { target: { value: '1.5' } });
    expect(mockUpdateNested).toHaveBeenCalledWith('avatars', 'breathe_scale', 1.5);
  });

});
