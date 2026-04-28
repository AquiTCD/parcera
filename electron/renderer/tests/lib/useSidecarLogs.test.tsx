import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { LogEntry } from '../../../lib/bridge';

const mockApi = {
  getLogHistory: vi.fn().mockResolvedValue([]),
  onLogMessage: vi.fn(() => vi.fn()),
};

vi.mock('../../lib/electron-bridge', () => ({ api: mockApi }));

const { useSidecarLogs } = await import('../../lib/hooks/useSidecarLogs');

const makeLog = (text: string): LogEntry => ({ source: 'stdout', text, time: Date.now() });

describe('useSidecarLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.getLogHistory.mockResolvedValue([]);
    mockApi.onLogMessage.mockReturnValue(vi.fn());
  });

  it('loads log history on mount', async () => {
    const logs = [makeLog('hello')];
    mockApi.getLogHistory.mockResolvedValue(logs);

    const { result } = renderHook(() => useSidecarLogs());
    await act(async () => {});

    expect(mockApi.getLogHistory).toHaveBeenCalledOnce();
    expect(result.current.logs).toEqual(logs);
  });

  it('registers onLogMessage listener on mount', async () => {
    renderHook(() => useSidecarLogs());
    await act(async () => {});
    expect(mockApi.onLogMessage).toHaveBeenCalledOnce();
  });

  it('unsubscribes from listener on unmount', async () => {
    const unsubscribe = vi.fn();
    mockApi.onLogMessage.mockReturnValue(unsubscribe);
    const { unmount } = renderHook(() => useSidecarLogs());
    await act(async () => {});
    unmount();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('appends new log when message arrives', async () => {
    let logListener: ((log: LogEntry) => void) | null = null;
    mockApi.onLogMessage.mockImplementation((cb) => {
      logListener = cb;
      return vi.fn();
    });

    const { result } = renderHook(() => useSidecarLogs());
    await act(async () => {});

    const newLog = makeLog('new message');
    act(() => { logListener!(newLog); });

    expect(result.current.logs).toContainEqual(newLog);
  });

  it('clearLogs empties the log list', async () => {
    const logs = [makeLog('msg1'), makeLog('msg2')];
    mockApi.getLogHistory.mockResolvedValue(logs);

    const { result } = renderHook(() => useSidecarLogs());
    await act(async () => {});

    act(() => { result.current.clearLogs(); });

    expect(result.current.logs).toHaveLength(0);
  });
});
