import type { ParceraSettings } from '../../../shared/types';

/**
 * Mapping of tab IDs to the settings keys that should be restored when
 * "Restore Defaults" is clicked for that tab.
 *
 * Each entry returns a partial settings object that overwrites the current settings.
 */
export function getDefaultsForTab(
  activeTab: string,
  defaults: ParceraSettings,
  current: ParceraSettings
): Partial<ParceraSettings> | null {
  switch (activeTab) {
    case 'llm':
      return { llm: defaults.llm };

    case 'stt':
      return {
        stt: defaults.stt,
        vad: defaults.vad,
        force_keywords: defaults.force_keywords,
        response_sensitivity: defaults.response_sensitivity,
        merge_request_threshold: defaults.merge_request_threshold,
      };

    case 'tts':
      return { tts: defaults.tts };

    case 'visual': {
      const prevWindows = current.electron?.windows || {};
      const defaultWindows = defaults.electron?.windows || {};
      return {
        avatars: defaults.avatars,
        electron: {
          ...current.electron,
          windows: {
            ...prevWindows,
            ai: defaultWindows.ai,
            user: defaultWindows.user,
          },
        },
      };
    }

    case 'system': {
      const prevWindows = current.electron?.windows;
      return {
        verbose: defaults.verbose,
        profile_mode: defaults.profile_mode,
        log_level: defaults.log_level,
        electron: { ...defaults.electron, windows: prevWindows },
      };
    }

    case 'profile':
      return {
        ai_profile: defaults.ai_profile,
        user_profile: defaults.user_profile,
        knowledge: defaults.knowledge,
      };

    default:
      return null;
  }
}
