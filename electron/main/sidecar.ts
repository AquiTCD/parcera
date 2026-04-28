import { app } from 'electron';
import path from 'node:path';
import { spawn, ChildProcess } from 'node:child_process';
import fs from 'node:fs';

export class PythonSidecar {
  private process: ChildProcess | null = null;
  private isShuttingDown = false;
  private restartCount = 0;
  private maxRestarts = 5;

  constructor(
    private configPath: string,
    private port: number,
    private onLog?: (source: 'stdout' | 'stderr', text: string) => void
  ) { }

  public async start(): Promise<void> {
    const pythonPath = this.getPythonExecutable();
    const scriptPath = this.getScriptPath();

    console.log(`[Sidecar] Starting Python engine...`);
    console.log(`[Sidecar] Python: ${pythonPath}`);
    console.log(`[Sidecar] Script: ${scriptPath}`);
    console.log(`[Sidecar] Config: ${this.configPath}`);

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PARCERA_CONFIG_PATH: this.configPath,
      PYTHONUNBUFFERED: '1',
    };

    // In production, we might need to set PYTHONPATH to include our site-packages
    if (app.isPackaged) {
      const sitePackages = path.join(process.resourcesPath, 'site-packages');
      env.PYTHONPATH = sitePackages;
    }

    this.process = spawn(pythonPath, [scriptPath], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    this.process.stdout?.on('data', (data) => {
      const text = data.toString().trim();
      // Use process.stdout.write to skip console.log interceptor entirely
      process.stdout.write(`${text}\n`);
      this.onLog?.('stdout', text);
    });

    this.process.stderr?.on('data', (data) => {
      const text = data.toString().trim();
      // Heuristic: If stderr contains common info patterns, treat as info
      const isInfo = /INFO:|\[USER\]:|\[AI\]:|✨|Application startup complete|Uvicorn running/.test(text);

      if (isInfo) {
        process.stdout.write(`${text}\n`);
        this.onLog?.('stdout', text);
      } else {
        process.stderr.write(`${text}\n`);
        this.onLog?.('stderr', text);
      }
    });

    this.process.on('exit', (code, signal) => {
      console.log(`[Sidecar] Python process exited with code ${code} and signal ${signal}`);
      this.process = null;

      if (!this.isShuttingDown) {
        this.handleCrash();
      }
    });
  }

  public stop(): void {
    this.isShuttingDown = true;
    if (!this.process) return;

    const proc = this.process;
    const pid = proc.pid;
    console.log(`[Sidecar] Stopping Python engine (PID: ${pid})...`);

    // 1. Send SIGTERM (graceful shutdown)
    proc.kill('SIGTERM');

    // 2. Force kill after 3 seconds if still alive
    const forceKillTimer = setTimeout(() => {
      try {
        if (pid) {
          process.kill(pid, 'SIGKILL');
          console.log(`[Sidecar] Force-killed Python engine (PID: ${pid}) via SIGKILL`);
        }
      } catch {
        // Process already exited — ignore
      }
    }, 3000);

    // Clean up timer if process exits gracefully
    proc.once('exit', () => {
      clearTimeout(forceKillTimer);
      console.log(`[Sidecar] Python engine stopped cleanly.`);
    });

    this.process = null;
  }

  private handleCrash(): void {
    if (this.restartCount < this.maxRestarts) {
      this.restartCount++;
      const delay = Math.min(1000 * Math.pow(2, this.restartCount), 30000);
      console.log(`[Sidecar] Attempting restart ${this.restartCount}/${this.maxRestarts} in ${delay}ms...`);
      setTimeout(() => this.start(), delay);
    } else {
      console.error('[Sidecar] Max restarts reached. Python engine failed to stay alive.');
    }
  }

  private getDevRoot(): string {
    return process.env['APP_ROOT']
      ? path.join(process.env['APP_ROOT'], '..')
      : path.join(app.getAppPath(), '..');
  }

  private getPythonExecutable(): string {
    const isWindows = process.platform === 'win32';
    if (app.isPackaged) {
      if (isWindows) {
        return path.join(process.resourcesPath, 'bin', 'python-runtime', 'python.exe');
      }
      return path.join(process.resourcesPath, 'bin', 'python-runtime', 'bin', 'python3');
    }
    const root = this.getDevRoot();
    if (isWindows) {
      return path.join(root, '.venv', 'Scripts', 'python.exe');
    }
    return path.join(root, '.venv', 'bin', 'python');
  }

  private getScriptPath(): string {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'src', 'run_server.py');
    }
    return path.join(this.getDevRoot(), 'src', 'run_server.py');
  }
}
