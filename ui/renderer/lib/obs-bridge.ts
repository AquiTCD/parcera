/**
 * OBS Browser Source API Bridge
 *
 * Implements ParceraAPI without any Tauri IPC, so the page can run inside
 * OBS's browser source (which has no access to __TAURI_INTERNALS__).
 *
 * Python port derivation: frontend is served at http://localhost:{F}/
 * The Python sidecar always listens on port F-1 (e.g. F=8677 → Python=8676).
 */
import type { ParceraAPI, Rect, LogEntry, OpResult, TwitchStatus, DownloadProgress } from './bridge';
import type { ParceraSettings } from '../../shared/types';

function getPythonPort(): number {
  const frontendPort = parseInt(window.location.port, 10);
  // Vite dev server runs on 5000–6000 range; Python is still at its default port (8676)
  if (frontendPort >= 5000 && frontendPort < 6000) return 8676;
  // Production via tauri-plugin-localhost: frontend_port = python_port + 1
  return frontendPort > 1 ? frontendPort - 1 : 8676;
}

function pythonUrl(path: string): string {
  const port = getPythonPort();
  return `http://127.0.0.1:${port}${path.startsWith('/') ? path : '/' + path}`;
}

const noop = (): void => {};
const noopPromise = <T>(val: T) => (): Promise<T> => Promise.resolve(val);
const noopUnsubscribe = () => noop;

export const obsApi: ParceraAPI = {
  platform: 'obs',

  // Settings — fetched from Python HTTP endpoint
  getSettings: async (): Promise<ParceraSettings> => {
    const res = await fetch(pythonUrl('/config/settings'));
    if (!res.ok) throw new Error(`GET /config/settings failed: ${res.status}`);
    return res.json();
  },
  getDefaultSettings: async (): Promise<ParceraSettings> => {
    // Default settings are not available in OBS mode; return empty object.
    return {};
  },
  saveSettings: noopPromise({ success: false, error: 'OBS mode: read-only' } as OpResult),
  updateSetting: noopPromise({ success: false, error: 'OBS mode: read-only' } as OpResult),
  reloadSettings: async (): Promise<ParceraSettings> => obsApi.getSettings(),
  onSettingsChanged: (_cb) => noop,

  // Window — no-ops (OBS controls the window)
  resizeWindow: noop,
  setResizable: noop,
  closeWindow: noop,
  getWindowBounds: noopPromise(null as Rect | null),
  saveWindowBounds: noopPromise({ success: false } as OpResult),
  getAvatarWindowBounds: noopPromise(null as Rect | null),
  setWindowVisible: noopPromise(undefined as void),
  setWindowAlwaysOnTop: noopPromise(undefined as void),

  // FS / Dialog — no-ops
  selectDirectory: noopPromise(null as string | null),
  resolveLocalPath: (filePath: string): string => {
    if (filePath.startsWith('assets/') || filePath.startsWith('/assets/')) {
      return filePath.startsWith('/') ? filePath.slice(1) : filePath;
    }
    return filePath;
  },

  // Logs — not accessible in OBS mode
  getLogHistory: noopPromise([] as LogEntry[]),
  onLogMessage: noopUnsubscribe,

  // Models — forward to Python backend
  checkModelCached: async (modelName, port) => {
    const p = port ?? getPythonPort();
    const res = await fetch(`http://127.0.0.1:${p}/models/check?name=${encodeURIComponent(modelName)}`);
    const data = await res.json();
    return data.cached as boolean;
  },
  downloadModel: (_modelName, _onProgress, _port) => noop,
  reloadModel: async (port) => {
    const p = port ?? getPythonPort();
    await fetch(`http://127.0.0.1:${p}/models/reload`, { method: 'POST' });
    return { success: true } as OpResult;
  },

  // Twitch — not usable in OBS mode
  twitchStartAuth: noopPromise(undefined as void),
  twitchGetAuthStatus: noopPromise(false),
  twitchClearAuth: noopPromise(false),
  twitchTestEvent: noopPromise({ success: false } as OpResult),
  getTwitchStatus: noopPromise({ initialized: false } as TwitchStatus),
  onTwitchAuthStatus: noopUnsubscribe,

  // Profiles / Training — not usable in OBS mode
  openTrainingWindow: noop,
  broadcastProfilesUpdated: noop,
  onProfilesUpdated: noopUnsubscribe,
  onTrainingProfileChanged: noopUnsubscribe,
};
