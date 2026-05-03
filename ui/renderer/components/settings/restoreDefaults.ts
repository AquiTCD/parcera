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
    // ── New sidebar section IDs ──────────────────────────────────────────────
    case 'character':
      return {
        ai_profile: defaults.ai_profile,
        user_profile: defaults.user_profile,
        knowledge: defaults.knowledge,
        tts: defaults.tts,
        avatars: defaults.avatars,
      };

    case 'mic':
      return {
        stt: defaults.stt,
        vad: defaults.vad,
        force_keywords: defaults.force_keywords,
        response_sensitivity: defaults.response_sensitivity,
        merge_request_threshold: defaults.merge_request_threshold,
      };

    case 'integration':
      return { twitch: defaults.twitch };

    case 'advanced':
      return { llm: defaults.llm, stt: defaults.stt, tts: defaults.tts };

    case 'developer': {
      const prevWindows = current.app?.windows;
      return {
        verbose: defaults.verbose,
        profile_mode: defaults.profile_mode,
        log_level: defaults.log_level,
        simple_log: defaults.simple_log,
        app: { ...defaults.app, windows: prevWindows },
      };
    }

    // ── Legacy tab IDs (kept for backward compat) ────────────────────────────
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
      const prevWindows = current.app?.windows || {};
      const defaultWindows = defaults.app?.windows || {};
      return {
        avatars: defaults.avatars,
        app: {
          ...current.app,
          windows: {
            ...prevWindows,
            ai: defaultWindows.ai,
            user: defaultWindows.user,
          },
        },
      };
    }

    case 'system': {
      const prevWindows = current.app?.windows;
      return {
        verbose: defaults.verbose,
        profile_mode: defaults.profile_mode,
        log_level: defaults.log_level,
        app: { ...defaults.app, windows: prevWindows },
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
