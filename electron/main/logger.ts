import { BrowserWindow, ipcMain } from 'electron';
import type { SidecarLogMessage } from '../shared/types';

const MAX_LOG_HISTORY = 1000;

class LogManager {
  private buffer: SidecarLogMessage[] = [];
  private originalLog = console.log;
  private originalError = console.error;

  constructor() {
    this.setupInterceptors();
    this.setupIpc();
  }

  private setupInterceptors() {
    console.log = (...args: any[]) => {
      this.originalLog(...args);
      const text = args.map(String).join(' ');
      // Avoid double-logging sidecar messages already handled by the sidecar callback
      if (!text.startsWith('[Python]')) {
        this.addLog('stdout', `[Main] ${text}`);
      }
    };

    console.error = (...args: any[]) => {
      this.originalError(...args);
      const text = args.map(String).join(' ');
      if (!text.startsWith('[Python Error]')) {
        this.addLog('stderr', `[Main Error] ${text}`);
      }
    };
  }

  private setupIpc() {
    ipcMain.handle('get-log-history', () => this.getHistory());
  }

  public addLog(source: 'stdout' | 'stderr', text: string) {
    const logMsg: SidecarLogMessage = {
      source,
      text,
      timestamp: new Date().toLocaleTimeString(),
    };

    this.buffer.push(logMsg);
    if (this.buffer.length > MAX_LOG_HISTORY) {
      this.buffer.shift();
    }

    // Broadcast to all open windows
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send('sidecar-log', logMsg);
      }
    });
  }

  public getHistory(): SidecarLogMessage[] {
    return this.buffer;
  }
}

export const logManager = new LogManager();
