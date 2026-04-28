import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ParceraSettings } from '../../../shared/types';

const mockElectronAPI = {
  platform: 'darwin',
  getSettings: vi.fn(),
  getDefaultSettings: vi.fn(),
  saveSettings: vi.fn(),
  updateSetting: vi.fn(),
  reloadSettings: vi.fn(),
  onSettingsChanged: vi.fn(),
  resizeWindow: vi.fn(),
  setResizable: vi.fn(),
  closeWindow: vi.fn(),
  getWindowBounds: vi.fn(),
  saveWindowBounds: vi.fn(),
  getAvatarWindowBounds: vi.fn(),
  selectDirectory: vi.fn(),
  resolveLocalPath: vi.fn((p: string) => `parcera-asset://${p}`),
  getLogHistory: vi.fn().mockResolvedValue([]),
  onLogMessage: vi.fn(),
  checkModelCached: vi.fn(),
  downloadModel: vi.fn(),
  reloadModel: vi.fn(),
  twitchStartAuth: vi.fn(),
  twitchGetAuthStatus: vi.fn(),
  twitchClearAuth: vi.fn(),
  twitchTestEvent: vi.fn(),
  getTwitchStatus: vi.fn(),
  onTwitchAuthStatus: vi.fn(),
  openTrainingWindow: vi.fn(),
  broadcastProfilesUpdated: vi.fn(),
  onProfilesUpdated: vi.fn(),
  onTrainingProfileChanged: vi.fn(),
};

(window as any).electronAPI = mockElectronAPI;

// Dynamic import so window.electronAPI is already set when module initializes
const getApi = async () => (await import('../../lib/electron-bridge')).api;

describe('electronBridge', () => {
  beforeEach(() => vi.clearAllMocks());

  it('exposes platform from window.electronAPI', async () => {
    const api = await getApi();
    expect(api.platform).toBe('darwin');
  });

  describe('Settings', () => {
    it('getSettings delegates to window.electronAPI', async () => {
      const api = await getApi();
      const settings: Partial<ParceraSettings> = { verbose: true };
      mockElectronAPI.getSettings.mockResolvedValue(settings);
      const result = await api.getSettings();
      expect(mockElectronAPI.getSettings).toHaveBeenCalledOnce();
      expect(result).toEqual(settings);
    });

    it('saveSettings passes settings to window.electronAPI', async () => {
      const api = await getApi();
      mockElectronAPI.saveSettings.mockResolvedValue({ success: true });
      const settings = { verbose: false } as ParceraSettings;
      await api.saveSettings(settings);
      expect(mockElectronAPI.saveSettings).toHaveBeenCalledWith(settings);
    });

    it('updateSetting passes key and value', async () => {
      const api = await getApi();
      mockElectronAPI.updateSetting.mockResolvedValue({ success: true });
      await api.updateSetting('vad.start_muted', true);
      expect(mockElectronAPI.updateSetting).toHaveBeenCalledWith('vad.start_muted', true);
    });

    it('onSettingsChanged registers listener and returns cleanup fn', async () => {
      const api = await getApi();
      const cb = vi.fn();
      const result = api.onSettingsChanged(cb);
      expect(mockElectronAPI.onSettingsChanged).toHaveBeenCalledWith(cb);
      expect(typeof result).toBe('function');
    });

    it('getDefaultSettings delegates to window.electronAPI', async () => {
      const api = await getApi();
      mockElectronAPI.getDefaultSettings.mockResolvedValue({});
      await api.getDefaultSettings();
      expect(mockElectronAPI.getDefaultSettings).toHaveBeenCalledOnce();
    });
  });

  describe('Window', () => {
    it('closeWindow delegates to window.electronAPI', async () => {
      const api = await getApi();
      api.closeWindow();
      expect(mockElectronAPI.closeWindow).toHaveBeenCalledOnce();
    });

    it('setResizable passes value to window.electronAPI', async () => {
      const api = await getApi();
      api.setResizable(false);
      expect(mockElectronAPI.setResizable).toHaveBeenCalledWith(false);
    });

    it('resizeWindow passes dimensions to window.electronAPI', async () => {
      const api = await getApi();
      api.resizeWindow(800, 600);
      expect(mockElectronAPI.resizeWindow).toHaveBeenCalledWith(800, 600);
    });

    it('getAvatarWindowBounds passes type to window.electronAPI', async () => {
      const api = await getApi();
      mockElectronAPI.getAvatarWindowBounds.mockResolvedValue({ x: 0, y: 0, width: 400, height: 400 });
      await api.getAvatarWindowBounds('ai');
      expect(mockElectronAPI.getAvatarWindowBounds).toHaveBeenCalledWith('ai');
    });
  });

  describe('FS', () => {
    it('resolveLocalPath delegates to window.electronAPI', async () => {
      const api = await getApi();
      const result = api.resolveLocalPath('/some/path.png');
      expect(mockElectronAPI.resolveLocalPath).toHaveBeenCalledWith('/some/path.png');
      expect(result).toBe('parcera-asset:///some/path.png');
    });

    it('selectDirectory passes currentPath to window.electronAPI', async () => {
      const api = await getApi();
      mockElectronAPI.selectDirectory.mockResolvedValue('/selected/path');
      await api.selectDirectory('/current');
      expect(mockElectronAPI.selectDirectory).toHaveBeenCalledWith('/current');
    });
  });

  describe('Logs', () => {
    it('getLogHistory delegates to window.electronAPI', async () => {
      const api = await getApi();
      const logs = [{ source: 'stdout', text: 'hello', time: 1000 }];
      mockElectronAPI.getLogHistory.mockResolvedValue(logs);
      const result = await api.getLogHistory();
      expect(result).toEqual(logs);
      expect(mockElectronAPI.getLogHistory).toHaveBeenCalledOnce();
    });

    it('onLogMessage registers listener and returns cleanup fn', async () => {
      const api = await getApi();
      const unsubscribe = vi.fn();
      mockElectronAPI.onLogMessage.mockReturnValue(unsubscribe);
      const cb = vi.fn();
      const result = api.onLogMessage(cb);
      expect(mockElectronAPI.onLogMessage).toHaveBeenCalledWith(cb);
      expect(typeof result).toBe('function');
    });
  });

  describe('Twitch', () => {
    it('twitchStartAuth delegates to window.electronAPI', async () => {
      const api = await getApi();
      mockElectronAPI.twitchStartAuth.mockResolvedValue(undefined);
      await api.twitchStartAuth();
      expect(mockElectronAPI.twitchStartAuth).toHaveBeenCalledOnce();
    });

    it('twitchGetAuthStatus delegates to window.electronAPI', async () => {
      const api = await getApi();
      mockElectronAPI.twitchGetAuthStatus.mockResolvedValue(true);
      const result = await api.twitchGetAuthStatus();
      expect(result).toBe(true);
    });

    it('onTwitchAuthStatus registers listener and returns cleanup fn', async () => {
      const api = await getApi();
      const unsubscribe = vi.fn();
      mockElectronAPI.onTwitchAuthStatus.mockReturnValue(unsubscribe);
      const cb = vi.fn();
      const result = api.onTwitchAuthStatus(cb);
      expect(mockElectronAPI.onTwitchAuthStatus).toHaveBeenCalledWith(cb);
      expect(typeof result).toBe('function');
    });
  });

  describe('Profiles', () => {
    it('openTrainingWindow passes profile to window.electronAPI', async () => {
      const api = await getApi();
      api.openTrainingWindow('default');
      expect(mockElectronAPI.openTrainingWindow).toHaveBeenCalledWith('default');
    });

    it('broadcastProfilesUpdated delegates to window.electronAPI', async () => {
      const api = await getApi();
      api.broadcastProfilesUpdated();
      expect(mockElectronAPI.broadcastProfilesUpdated).toHaveBeenCalledOnce();
    });

    it('onProfilesUpdated registers listener and returns cleanup fn', async () => {
      const api = await getApi();
      const unsubscribe = vi.fn();
      mockElectronAPI.onProfilesUpdated.mockReturnValue(unsubscribe);
      const cb = vi.fn();
      const result = api.onProfilesUpdated(cb);
      expect(mockElectronAPI.onProfilesUpdated).toHaveBeenCalledWith(cb);
      expect(typeof result).toBe('function');
    });
  });
});
