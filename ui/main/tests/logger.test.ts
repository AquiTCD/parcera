import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logManager } from '../logger';
import { BrowserWindow, ipcMain } from 'electron';

// Mock Electron
vi.mock('electron', () => {
  const bw = {
    getAllWindows: vi.fn(() => []),
  };
  return {
    BrowserWindow: bw,
    ipcMain: {
      handle: vi.fn(),
    },
  };
});

describe('LogManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset buffer for each test if possible,
    // but since it's a singleton we can just test accumulation
  });

  it('adds logs to the buffer', () => {
    const initialCount = logManager.getHistory().length;
    logManager.addLog('stdout', 'Test Log 1');
    const history = logManager.getHistory();
    expect(history.length).toBe(initialCount + 1);
    expect(history[history.length - 1].text).toBe('Test Log 1');
  });

  it('broadcasts logs to windows', () => {
    const mockWin = {
      isDestroyed: vi.fn(() => false),
      webContents: {
        send: vi.fn(),
      },
    };
    (BrowserWindow.getAllWindows as any).mockReturnValue([mockWin]);

    logManager.addLog('stdout', 'Broadcast Test');
    expect(mockWin.webContents.send).toHaveBeenCalledWith('sidecar-log', expect.objectContaining({
      text: 'Broadcast Test'
    }));
  });

  it('caps history at MAX_LOG_HISTORY', () => {
    // Since we can't easily reset the private buffer of the singleton without changing code,
    // let's just verify the logic exists in the code or trust the push/shift pattern.
    // In a real scenario, we might add a reset method for testing.
    for (let i = 0; i < 1100; i++) {
      logManager.addLog('stdout', `Log ${i}`);
    }
    expect(logManager.getHistory().length).toBeLessThanOrEqual(1000);
  });
});
