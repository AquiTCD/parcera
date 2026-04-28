import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockApi = {
  resizeWindow: vi.fn(),
  setResizable: vi.fn(),
  closeWindow: vi.fn(),
  getWindowBounds: vi.fn(),
  saveWindowBounds: vi.fn(),
  getAvatarWindowBounds: vi.fn(),
};

vi.mock('../../lib/electron-bridge', () => ({ api: mockApi }));

const { useWindow } = await import('../../lib/hooks/useWindow');

describe('useWindow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resizeWindow calls api.resizeWindow with dimensions', () => {
    const { result } = renderHook(() => useWindow());
    act(() => { result.current.resizeWindow(800, 600); });
    expect(mockApi.resizeWindow).toHaveBeenCalledWith(800, 600);
  });

  it('setResizable calls api.setResizable', () => {
    const { result } = renderHook(() => useWindow());
    act(() => { result.current.setResizable(false); });
    expect(mockApi.setResizable).toHaveBeenCalledWith(false);
  });

  it('closeWindow calls api.closeWindow', () => {
    const { result } = renderHook(() => useWindow());
    act(() => { result.current.closeWindow(); });
    expect(mockApi.closeWindow).toHaveBeenCalledOnce();
  });

  it('getWindowBounds returns result from api', async () => {
    const bounds = { x: 10, y: 20, width: 400, height: 300 };
    mockApi.getWindowBounds.mockResolvedValue(bounds);
    const { result } = renderHook(() => useWindow());

    let res: any;
    await act(async () => { res = await result.current.getWindowBounds(); });

    expect(mockApi.getWindowBounds).toHaveBeenCalledOnce();
    expect(res).toEqual(bounds);
  });

  it('saveWindowBounds passes type to api', async () => {
    mockApi.saveWindowBounds.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useWindow());

    await act(async () => { await result.current.saveWindowBounds('ai'); });

    expect(mockApi.saveWindowBounds).toHaveBeenCalledWith('ai');
  });

  it('getAvatarWindowBounds passes type to api', async () => {
    const bounds = { x: 0, y: 0, width: 400, height: 400 };
    mockApi.getAvatarWindowBounds.mockResolvedValue(bounds);
    const { result } = renderHook(() => useWindow());

    let res: any;
    await act(async () => { res = await result.current.getAvatarWindowBounds('user'); });

    expect(mockApi.getAvatarWindowBounds).toHaveBeenCalledWith('user');
    expect(res).toEqual(bounds);
  });
});
