import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ParceraSettings } from '../../../shared/types';

// ---- Tauri API mocks --------------------------------------------------------

const mockInvoke = vi.fn();
const mockConvertFileSrc = vi.fn((p: string) => `asset://localhost${p}`);
vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke,
  convertFileSrc: mockConvertFileSrc,
}));

const mockListen = vi.fn();
vi.mock('@tauri-apps/api/event', () => ({
  listen: mockListen,
}));

const mockWin = {
  setSize: vi.fn().mockResolvedValue(undefined),
  setResizable: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
  outerPosition: vi.fn().mockResolvedValue({ x: 100, y: 200 }),
  outerSize: vi.fn().mockResolvedValue({ width: 800, height: 600 }),
  scaleFactor: vi.fn().mockResolvedValue(2),
};
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => mockWin,
}));

vi.mock('@tauri-apps/api/dpi', () => ({
  LogicalSize: class LogicalSize {
    constructor(public width: number, public height: number) {}
  },
}));

// --------------------------------------------------------------------------

const { api } = await import('../../lib/tauri-bridge');

describe('tauriBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListen.mockResolvedValue(vi.fn());
  });

  describe('Settings', () => {
    it('getSettings invokes get_settings command', async () => {
      const settings: Partial<ParceraSettings> = { verbose: true };
      mockInvoke.mockResolvedValue(settings);
      const result = await api.getSettings();
      expect(mockInvoke).toHaveBeenCalledWith('get_settings');
      expect(result).toEqual(settings);
    });

    it('getDefaultSettings invokes get_default_settings command', async () => {
      mockInvoke.mockResolvedValue({});
      await api.getDefaultSettings();
      expect(mockInvoke).toHaveBeenCalledWith('get_default_settings');
    });

    it('saveSettings invokes save_settings with settings payload', async () => {
      mockInvoke.mockResolvedValue({ success: true });
      const settings = { verbose: false } as ParceraSettings;
      await api.saveSettings(settings);
      expect(mockInvoke).toHaveBeenCalledWith('save_settings', { settings });
    });

    it('updateSetting invokes update_setting with key and value', async () => {
      mockInvoke.mockResolvedValue({ success: true });
      await api.updateSetting('vad.start_muted', true);
      expect(mockInvoke).toHaveBeenCalledWith('update_setting', { key: 'vad.start_muted', value: true });
    });

    it('onSettingsChanged listens to settings-changed event and returns cleanup fn', async () => {
      const unlisten = vi.fn();
      mockListen.mockResolvedValue(unlisten);
      const cb = vi.fn();

      const cleanup = api.onSettingsChanged(cb);

      expect(mockListen).toHaveBeenCalledWith('settings-changed', expect.any(Function));
      expect(typeof cleanup).toBe('function');

      // cleanup should eventually call unlisten
      await cleanup();
      expect(unlisten).toHaveBeenCalledOnce();
    });

    it('onSettingsChanged forwards payload to callback when event fires', async () => {
      const settings: Partial<ParceraSettings> = { verbose: true };
      mockListen.mockImplementation(async (_event, handler) => {
        handler({ payload: settings });
        return vi.fn();
      });
      const cb = vi.fn();
      api.onSettingsChanged(cb);
      await vi.waitFor(() => expect(cb).toHaveBeenCalledWith(settings));
    });
  });

  describe('Window', () => {
    it('resizeWindow calls getCurrentWindow().setSize with LogicalSize', async () => {
      await api.resizeWindow(800, 600);
      expect(mockWin.setSize).toHaveBeenCalledWith(expect.objectContaining({ width: 800, height: 600 }));
    });

    it('setResizable calls getCurrentWindow().setResizable', async () => {
      await api.setResizable(false);
      expect(mockWin.setResizable).toHaveBeenCalledWith(false);
    });

    it('closeWindow calls getCurrentWindow().close', async () => {
      await api.closeWindow();
      expect(mockWin.close).toHaveBeenCalledOnce();
    });

    it('getWindowBounds returns logical bounds from outerPosition + outerSize', async () => {
      // scaleFactor=2, pos=(100,200), size=(800,600) → logical=(50,100,400,300)
      const result = await api.getWindowBounds();
      expect(result).toEqual({ x: 50, y: 100, width: 400, height: 300 });
    });

    it('saveWindowBounds invokes save_window_bounds with type', async () => {
      mockInvoke.mockResolvedValue({ success: true });
      await api.saveWindowBounds('ai');
      expect(mockInvoke).toHaveBeenCalledWith('save_window_bounds', { window_type: 'ai' });
    });

    it('getAvatarWindowBounds invokes get_avatar_window_bounds with type', async () => {
      mockInvoke.mockResolvedValue({ x: 0, y: 0, width: 400, height: 400 });
      await api.getAvatarWindowBounds('user');
      expect(mockInvoke).toHaveBeenCalledWith('get_avatar_window_bounds', { window_type: 'user' });
    });
  });

  describe('FS', () => {
    it('resolveLocalPath uses convertFileSrc for absolute paths', () => {
      const result = api.resolveLocalPath('/some/path/image.png');
      expect(mockConvertFileSrc).toHaveBeenCalledWith('/some/path/image.png');
      expect(result).toBe('asset://localhost/some/path/image.png');
    });

    it('resolveLocalPath returns relative assets paths as-is', () => {
      const result = api.resolveLocalPath('assets/user/base.png');
      expect(mockConvertFileSrc).not.toHaveBeenCalled();
      expect(result).toBe('assets/user/base.png');
    });

    it('selectDirectory invokes select_directory command', async () => {
      mockInvoke.mockResolvedValue('/selected/path');
      const result = await api.selectDirectory('/current');
      expect(mockInvoke).toHaveBeenCalledWith('select_directory', { current_path: '/current' });
      expect(result).toBe('/selected/path');
    });
  });

  describe('Logs', () => {
    it('getLogHistory invokes get_log_history command', async () => {
      const logs = [{ source: 'stdout', text: 'hello', timestamp: '2026-01-01T00:00:00Z' }];
      mockInvoke.mockResolvedValue(logs);
      const result = await api.getLogHistory();
      expect(mockInvoke).toHaveBeenCalledWith('get_log_history');
      expect(result).toEqual(logs);
    });

    it('onLogMessage listens to sidecar-log event and returns cleanup fn', async () => {
      const unlisten = vi.fn();
      mockListen.mockResolvedValue(unlisten);
      const cb = vi.fn();

      const cleanup = api.onLogMessage(cb);
      expect(mockListen).toHaveBeenCalledWith('sidecar-log', expect.any(Function));

      await cleanup();
      expect(unlisten).toHaveBeenCalledOnce();
    });
  });

  describe('Twitch', () => {
    it('twitchStartAuth invokes twitch_start_auth', async () => {
      mockInvoke.mockResolvedValue(undefined);
      await api.twitchStartAuth();
      expect(mockInvoke).toHaveBeenCalledWith('twitch_start_auth');
    });

    it('twitchGetAuthStatus invokes twitch_get_auth_status', async () => {
      mockInvoke.mockResolvedValue(true);
      const result = await api.twitchGetAuthStatus();
      expect(mockInvoke).toHaveBeenCalledWith('twitch_get_auth_status');
      expect(result).toBe(true);
    });

    it('twitchClearAuth invokes twitch_clear_auth', async () => {
      mockInvoke.mockResolvedValue(true);
      await api.twitchClearAuth();
      expect(mockInvoke).toHaveBeenCalledWith('twitch_clear_auth');
    });

    it('onTwitchAuthStatus listens to twitch-auth-status event', async () => {
      mockListen.mockResolvedValue(vi.fn());
      const cb = vi.fn();
      api.onTwitchAuthStatus(cb);
      expect(mockListen).toHaveBeenCalledWith('twitch-auth-status', expect.any(Function));
    });
  });

  describe('Models', () => {
    beforeEach(() => {
      global.fetch = vi.fn();
    });

    it('checkModelCached fetches correct query-param URL', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        json: async () => ({ cached: true }),
      });
      const result = await api.checkModelCached('gemma3:4b', 8676);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8676/models/check?name=gemma3%3A4b'
      );
      expect(result).toBe(true);
    });

    it('checkModelCached uses default port 8676', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        json: async () => ({ cached: false }),
      });
      await api.checkModelCached('whisper');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('127.0.0.1:8676')
      );
    });

    it('downloadModel fetches with GET (no method override)', async () => {
      const mockReader = {
        read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
      };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        body: { getReader: () => mockReader },
      });
      api.downloadModel('gemma3:4b', vi.fn(), 8676);
      await vi.waitFor(() => expect(global.fetch).toHaveBeenCalled());
      const [url, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toBe('http://127.0.0.1:8676/models/download?name=gemma3%3A4b');
      expect(opts?.method).toBeUndefined();
    });

    it('reloadModel sends POST to /models/reload', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({});
      await api.reloadModel(8676);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8676/models/reload',
        { method: 'POST' }
      );
    });
  });

  describe('Profiles', () => {
    it('openTrainingWindow invokes open_training_window', async () => {
      mockInvoke.mockResolvedValue(undefined);
      await api.openTrainingWindow('default');
      expect(mockInvoke).toHaveBeenCalledWith('open_training_window', { profile: 'default' });
    });

    it('broadcastProfilesUpdated invokes broadcast_profiles_updated', async () => {
      mockInvoke.mockResolvedValue(undefined);
      await api.broadcastProfilesUpdated();
      expect(mockInvoke).toHaveBeenCalledWith('broadcast_profiles_updated');
    });

    it('onProfilesUpdated listens to profiles-updated event', async () => {
      mockListen.mockResolvedValue(vi.fn());
      const cb = vi.fn();
      api.onProfilesUpdated(cb);
      expect(mockListen).toHaveBeenCalledWith('profiles-updated', expect.any(Function));
    });

    it('onTrainingProfileChanged listens to training-profile-changed event', async () => {
      mockListen.mockResolvedValue(vi.fn());
      const cb = vi.fn();
      api.onTrainingProfileChanged(cb);
      expect(mockListen).toHaveBeenCalledWith('training-profile-changed', expect.any(Function));
    });
  });
});
