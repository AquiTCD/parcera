import { useState, useEffect, useCallback } from 'react';
import { api } from '../electron-bridge';
import type { ParceraSettings } from '../../../shared/types';
import type { OpResult } from '../bridge';

export function useSettings() {
  const [settings, setSettings] = useState<ParceraSettings | null>(null);

  useEffect(() => {
    api.getSettings().then(setSettings);
    const unsub = api.onSettingsChanged(setSettings);
    return unsub;
  }, []);

  const saveSettings = useCallback(
    (s: ParceraSettings): Promise<OpResult> => api.saveSettings(s),
    []
  );

  const updateSetting = useCallback(
    (key: string, value: unknown): Promise<OpResult> => api.updateSetting(key, value),
    []
  );

  const getDefaultSettings = useCallback(
    (): Promise<ParceraSettings> => api.getDefaultSettings(),
    []
  );

  return { settings, setSettings, saveSettings, updateSetting, getDefaultSettings };
}
