import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { state, logStatus } from '../state';
import type { AvatarConfig, ParceraSettings } from '../state';
import { initAudioContext, getContext, getAnalyser, setNoiseGateDb, connectToAnalyser } from '../audio';
import { initVisual } from '../visual';
import { startWebSocket, setupMicStreaming } from '../comm';

export function useAvatar() {
  const avatarImageRef = useRef<HTMLImageElement>(null);
  const statusDebugRef = useRef<HTMLDivElement>(null);
  const micTrackRef = useRef<MediaStreamTrack | null>(null);
  const [visible, setVisible] = useState(true);
  const [viewMode, setViewMode] = useState<'standard' | 'wide'>('standard');
  const [isLocked, setIsLocked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [mode, setMode] = useState<'soliloquy' | 'conversation'>('soliloquy');
  const [controlCorner, setControlCorner] = useState<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'>('bottom-right');
  const [micId, setMicId] = useState<string | undefined>(undefined);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'v') {
        setVisible(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // WKWebView (Tauri/Safari) requires a user gesture before AudioContext can run.
  // Listen on multiple event types until the context is actually running.
  useEffect(() => {
    const tryResume = () => {
      const ctx = getContext();
      if (!ctx || ctx.state !== 'suspended') return;
      ctx.resume().catch(() => {});
    };
    const events = ['pointerdown', 'click', 'keydown'] as const;
    events.forEach(e => document.addEventListener(e, tryResume));
    return () => events.forEach(e => document.removeEventListener(e, tryResume));
  }, []);

  const updateStatus = (text: string) => {
    logStatus(text);
  };

  useEffect(() => {
    if (avatarImageRef.current && statusDebugRef.current) {
      initVisual(avatarImageRef.current, statusDebugRef.current);
    }
  }, []);

  useEffect(() => {
    if (isLocked) {
      document.body.classList.add('is-locked');
    } else {
      document.body.classList.remove('is-locked');
    }
    api.setResizable(!isLocked);
  }, [isLocked]);



  useEffect(() => {
    let active = true;

    const startup = async () => {
      if (!active) return;
      updateStatus('Initializing Audio...');
      initAudioContext();
      const ctx = getContext();
      if (!ctx || ctx.state === 'closed') return;
      if (ctx.state === 'suspended') {
        await Promise.race([
          ctx.resume(),
          new Promise<void>(resolve => setTimeout(resolve, 500)),
        ]).catch(() => {});
      }

      try {
        if (micTrackRef.current) {
          micTrackRef.current.stop();
        }

        const constraints: MediaStreamConstraints = {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 16000,
            channelCount: 1,
            deviceId: micId && micId !== 'default' ? { exact: micId } : undefined
          }
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        const track = stream.getAudioTracks()[0];
        micTrackRef.current = track;

        const s = await api.getSettings();
        const initialMute = s.vad?.start_muted ?? false;
        const winConf = s.electron?.windows?.[state.avatarType];

        if (winConf?.locked) {
          setIsLocked(true);
        }
        if (winConf?.control_corner) setControlCorner(winConf.control_corner);

        setIsMuted(initialMute);
        track.enabled = !initialMute;

        const micSource = ctx.createMediaStreamSource(stream);
        // Connecting a MediaStreamSource sometimes unblocks suspended AudioContext
        // on macOS WKWebView — attempt resume again after mic is granted.
        if (ctx.state === 'suspended') {
          await ctx.resume().catch(() => {});
        }

        if (state.avatarType === 'user') {
          connectToAnalyser(micSource);
          updateStatus('User Mic Active');
        } else {
          await setupMicStreaming(micSource);
          updateStatus('AI System Listening...');
        }
      } catch (err) {
        console.error('Mic Access Error:', err);
        if (micId && micId !== 'default') {
          console.warn('[Parcera] Specific mic failed, falling back to default...');
          updateStatus('Mic Fallback');
          setMicId('default');
          return;
        }
        updateStatus('Mic Error');
      }

      if (state.avatarType === 'ai') startWebSocket();
      if (active) updateStatus('System Live');
    };

    startup();
    return () => { active = false; };
  }, [micId]);

  const handleImageError = () => {
    if (!avatarImageRef.current) return;
    const src = avatarImageRef.current.src;
    if (src.endsWith('/e.png')) {
      avatarImageRef.current.src = src.replace('/e.png', '/a.png');
    } else if (src.endsWith('/o.png')) {
      avatarImageRef.current.src = src.replace('/o.png', '/u.png');
    } else {
      avatarImageRef.current.style.opacity = '0.5';
    }
  };

  const [sensitivity, setSensitivityState] = useState<'low' | 'medium' | 'high'>('medium');

  useEffect(() => {
    const applySettings = (settings: ParceraSettings) => {
      state.settings = settings;

      const volumeDb = settings.vad?.volume_db_threshold ?? -20;
      state.threshold_db = volumeDb;
      state.threshold = Math.pow(10, volumeDb / 20) * 100;
      // Noise gate only applies to the user window (mic input).
      // AI window plays clean TTS audio — no ambient noise to gate out.
      if (state.avatarType !== 'ai') {
        setNoiseGateDb(volumeDb);
      }

      const bScale = settings.avatars?.breathe_scale || 1.005;
      const bAmp = settings.avatars?.breathe_amplitude || 2;
      const bDur = settings.avatars?.breathe_duration || 5000;
      document.documentElement.style.setProperty('--breathe-scale', String(bScale));
      document.documentElement.style.setProperty('--breathe-amplitude', `${bAmp}px`);
      document.documentElement.style.setProperty('--breathe-duration', `${bDur}ms`);

      const avatarConfig = settings.avatars?.[state.avatarType] as AvatarConfig | undefined;
      const rawPath = avatarConfig?.assets_dir || `assets/${state.avatarType}`;
      const assetsDir = api.resolveLocalPath(rawPath);

      if (avatarImageRef.current) {
        avatarImageRef.current.src = `${assetsDir}/base.png`;
      }

      setIsFlipped(avatarConfig?.flip_horizontal ?? false);

      const newMuted = settings.vad?.start_muted ?? false;
      setIsMuted(newMuted);
      if (micTrackRef.current) {
        micTrackRef.current.enabled = !newMuted;
      }

      const winConf = settings.electron?.windows?.[state.avatarType];
      if (winConf?.control_corner) {
        setControlCorner(winConf.control_corner);
      }

      if (winConf?.locked !== undefined) {
        setIsLocked(!!winConf.locked);
      }

      const newMode = settings.user_profile?.mode || 'soliloquy';
      setMode(prev => (prev === newMode ? prev : newMode));

      setSensitivityState((settings.response_sensitivity || 'medium') as 'low' | 'medium' | 'high');

      const newMicId = settings.electron?.mic_device_id || 'default';
      setMicId(prev => {
        if (prev === newMicId) return prev;
        console.log(`[Parcera] Mic ID changing: ${prev} -> ${newMicId}`);
        return newMicId;
      });
    };

    api.getSettings().then((s: ParceraSettings) => {
      applySettings(s);
      updateStatus('Settings Loaded');
    }).catch((e: any) => {
      console.error('Settings error:', e);
      updateStatus('Using Defaults');
    });

    return api.onSettingsChanged((s: ParceraSettings) => {
      applySettings(s);
      updateStatus('Settings Reloaded');
      console.log('[Parcera] Settings hot-reloaded');
    });
  }, []);

  const toggleMute = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (micTrackRef.current) micTrackRef.current.enabled = !nextMuted;
    updateStatus(nextMuted ? 'Muted' : 'Mic Active');
    await api.updateSetting('vad.start_muted', nextMuted);
  };

  const toggleMode = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextMode = mode === 'soliloquy' ? 'conversation' : 'soliloquy';
    setMode(nextMode);
    updateStatus(`Mode: ${nextMode}`);
    await api.updateSetting('user_profile.mode', nextMode);
  };

  const setSensitivity = async (level: 'low' | 'medium' | 'high') => {
    setSensitivityState(level);
    updateStatus(`Sensitivity: ${level}`);
    await api.updateSetting('response_sensitivity', level);
  };

  const toggleLock = async (e: React.MouseEvent) => {
    // Keep toggleLock as is for now since it handles multiple fields (bounds + locked)
    e.stopPropagation();
    const nextLocked = !isLocked;

    let currentBounds = null;
    if (nextLocked) {
      currentBounds = await api.getWindowBounds();
    }

    setIsLocked(nextLocked);

    const s = await api.getSettings();
    if (!s.electron) s.electron = {};
    if (!s.electron.windows) s.electron.windows = {};
    if (!s.electron.windows[state.avatarType]) s.electron.windows[state.avatarType] = {};

    const winConf = s.electron.windows[state.avatarType]!;
    winConf.locked = nextLocked;

    if (currentBounds) {
      winConf.x = Math.round(currentBounds.x);
      winConf.y = Math.round(currentBounds.y);
      winConf.width = Math.round(currentBounds.width);
      winConf.height = Math.round(currentBounds.height);
    }

    await api.saveSettings(s);
  };

  return {
    avatarImageRef,
    statusDebugRef,
    visible,
    viewMode,
    isLocked,
    isMuted,
    isFlipped,
    mode,
    sensitivity,
    controlCorner,
    handleImageError,
    toggleMute,
    toggleMode,
    toggleLock,
    setSensitivity,
  };
}
