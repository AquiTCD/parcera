import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ParceraSettings } from '../../../shared/types';

const mockApi = {
  getSettings: vi.fn(),
  getDefaultSettings: vi.fn(),
  saveSettings: vi.fn(),
  updateSetting: vi.fn(),
  onSettingsChanged: vi.fn(() => vi.fn()),
};

vi.mock('../../lib/electron-bridge', () => ({ api: mockApi }));

const { useSettings } = await import('../../lib/hooks/useSettings');

const baseSettings: ParceraSettings = { verbose: false };

describe('useSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.getSettings.mockResolvedValue(baseSettings);
    mockApi.onSettingsChanged.mockReturnValue(vi.fn());
  });

  it('loads settings on mount', async () => {
    const { result } = renderHook(() => useSettings());
    await act(async () => {});
    expect(mockApi.getSettings).toHaveBeenCalledOnce();
    expect(result.current.settings).toEqual(baseSettings);
  });

  it('registers settings change listener on mount', async () => {
    renderHook(() => useSettings());
    await act(async () => {});
    expect(mockApi.onSettingsChanged).toHaveBeenCalledOnce();
  });

  it('unsubscribes from listener on unmount', async () => {
    const unsubscribe = vi.fn();
    mockApi.onSettingsChanged.mockReturnValue(unsubscribe);
    const { unmount } = renderHook(() => useSettings());
    await act(async () => {});
    unmount();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('updates settings state when change event fires', async () => {
    let changeListener: ((s: ParceraSettings) => void) | null = null;
    mockApi.onSettingsChanged.mockImplementation((cb) => {
      changeListener = cb;
      return vi.fn();
    });

    const { result } = renderHook(() => useSettings());
    await act(async () => {});

    const updated: ParceraSettings = { verbose: true };
    act(() => { changeListener!(updated); });

    expect(result.current.settings).toEqual(updated);
  });

  it('saveSettings calls api.saveSettings and returns result', async () => {
    mockApi.saveSettings.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useSettings());
    await act(async () => {});

    let res: any;
    await act(async () => {
      res = await result.current.saveSettings(baseSettings);
    });

    expect(mockApi.saveSettings).toHaveBeenCalledWith(baseSettings);
    expect(res).toEqual({ success: true });
  });

  it('updateSetting calls api.updateSetting', async () => {
    mockApi.updateSetting.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useSettings());
    await act(async () => {});

    await act(async () => {
      await result.current.updateSetting('vad.start_muted', true);
    });

    expect(mockApi.updateSetting).toHaveBeenCalledWith('vad.start_muted', true);
  });

  it('getDefaultSettings calls api.getDefaultSettings', async () => {
    mockApi.getDefaultSettings.mockResolvedValue(baseSettings);
    const { result } = renderHook(() => useSettings());
    await act(async () => {});

    await act(async () => {
      await result.current.getDefaultSettings();
    });

    expect(mockApi.getDefaultSettings).toHaveBeenCalledOnce();
  });
});
