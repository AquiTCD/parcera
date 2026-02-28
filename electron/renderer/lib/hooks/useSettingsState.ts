import { useState } from 'react';
import type { ParceraSettings } from '../../../shared/types';

/**
 * Encapsulates all settings state mutation logic.
 * Provides immutable update helpers for root, nested, provider, and TTS-specific settings.
 */
export function useSettingsState(initial: ParceraSettings | null) {
  const [settings, setSettings] = useState<ParceraSettings | null>(initial);

  const updateRoot = (key: keyof ParceraSettings, value: any) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : null));
  };

  const updateNested = (section: keyof ParceraSettings, key: string, value: any) => {
    setSettings((prev) => {
      if (!prev) return null;
      if (key === '') {
        return { ...prev, [section]: value };
      }
      return { ...prev, [section]: { ...(prev[section] as any), [key]: value } };
    });
  };

  const updateProvider = (
    section: 'llm' | 'stt' | 'tts',
    providerName: string,
    key: string,
    value: any
  ) => {
    setSettings((prev) => {
      if (!prev) return null;
      const currentSection = (prev[section] as any) || {};
      const providers = currentSection.providers || {};
      const targetProvider = providers[providerName] || {};
      return {
        ...prev,
        [section]: {
          ...currentSection,
          providers: {
            ...providers,
            [providerName]: {
              ...targetProvider,
              [key]: value,
            },
          },
        },
      };
    });
  };

  const updateTTSSettings = (key: string, value: any) => {
    setSettings((prev) => {
      if (!prev) return null;
      const currentSection = prev.tts || {};
      const ttsSettings = currentSection.settings || {};
      return {
        ...prev,
        tts: {
          ...currentSection,
          settings: {
            ...ttsSettings,
            [key]: value,
          },
        },
      };
    });
  };

  return {
    settings,
    setSettings,
    updateRoot,
    updateNested,
    updateProvider,
    updateTTSSettings,
  };
}
