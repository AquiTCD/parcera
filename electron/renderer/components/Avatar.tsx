import React, { useEffect, useRef, useState } from 'react';
import { state, logStatus } from '../lib/state';
import type { AvatarType, AvatarConfig, ParceraSettings } from '../lib/state';
import { initAudioContext, getContext, getAnalyser, setNoiseGateDb } from '../lib/audio';
import { initVisual } from '../lib/visual';
import { startWebSocket, setupMicStreaming } from '../lib/comm';

// Initialize global state.avatarType immediately upon module execution
const params = new URLSearchParams(window.location.search);
state.avatarType = (params.get('type') as AvatarType) || 'user';
console.log('[Parcera] Avatar Type Initialized:', state.avatarType);

export const Avatar: React.FC = () => {
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'v') {
        setVisible(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Helper to update status directly in UI via the shared state
  const updateStatus = (text: string) => {
    logStatus(text);
  };

  // Initialize Visual Loop
  useEffect(() => {
    if (avatarImageRef.current && statusDebugRef.current) {
      initVisual(avatarImageRef.current, statusDebugRef.current);
    }
  }, []);

  // Sync lock state with body class (Side effect for external system)
  useEffect(() => {
    if (isLocked) {
      document.body.classList.add('is-locked');
    } else {
      document.body.classList.remove('is-locked');
    }
  }, [isLocked]);

  // Settings Handling & Initialization
  useEffect(() => {
    const applySettings = (settings: ParceraSettings) => {
      state.settings = settings;

      // Unified threshold: dB → noise gate + meter display
      const volumeDb = settings.vad?.volume_db_threshold ?? -20;
      state.threshold_db = volumeDb;
      state.threshold = Math.pow(10, volumeDb / 20) * 100;
      setNoiseGateDb(volumeDb);

      // Breathe animation CSS variables
      const bScale = settings.avatars?.breathe_scale || 1.005;
      const bAmp = settings.avatars?.breathe_amplitude || 2;
      const bDur = settings.avatars?.breathe_duration || 5000;
      document.documentElement.style.setProperty('--breathe-scale', String(bScale));
      document.documentElement.style.setProperty('--breathe-amplitude', `${bAmp}px`);
      document.documentElement.style.setProperty('--breathe-duration', `${bDur}ms`);

      // Avatar image
      const avatarConfig = settings.avatars?.[state.avatarType] as AvatarConfig | undefined;
      const rawPath = avatarConfig?.assets_dir || `assets/${state.avatarType}`;
      const assetsDir = window.electronAPI.resolveLocalPath(rawPath);

      if (avatarImageRef.current) {
        avatarImageRef.current.src = `${assetsDir}/base.png`;
      }

      setIsFlipped(avatarConfig?.flip_horizontal ?? false);

      // Mute sync across windows
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
        setIsLocked(winConf.locked);
        window.electronAPI.setResizable(!winConf.locked);
      }

      const newMode = settings.user_profile?.mode || 'soliloquy';
      setMode(newMode);
    };

    window.electronAPI.getSettings().then((s: ParceraSettings) => {
      applySettings(s);
      updateStatus('Settings Loaded');
    }).catch((e: any) => {
      console.error('Settings error:', e);
      updateStatus('Using Defaults');
    });

    return window.electronAPI.onSettingsChanged((s: ParceraSettings) => {
      applySettings(s);
      updateStatus('Settings Reloaded');
      console.log('[Parcera] Settings hot-reloaded');
    });
  }, []);

  // Audio/Mic Startup
  useEffect(() => {
    let active = true;

    const startup = async () => {
      if (!active) return;
      updateStatus('Initializing Audio...');
      initAudioContext();
      const ctx = getContext();
      if (!ctx || ctx.state === 'closed') return;
      if (ctx.state === 'suspended') await ctx.resume();

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        });

        const track = stream.getAudioTracks()[0];
        micTrackRef.current = track;

        // Apply initial settings from fetch
        const s = await window.electronAPI.getSettings();
        const initialMute = s.vad?.start_muted ?? false;
        const winConf = s.electron?.windows?.[state.avatarType];

        if (winConf?.locked) {
          setIsLocked(true);
          window.electronAPI.setResizable(false);
        }
        if (winConf?.control_corner) setControlCorner(winConf.control_corner);

        setIsMuted(initialMute);
        track.enabled = !initialMute;

        const micSource = ctx.createMediaStreamSource(stream);
        const analyser = getAnalyser();

        if (state.avatarType === 'user') {
          if (analyser) micSource.connect(analyser);
          updateStatus('User Mic Active');
        } else {
          await setupMicStreaming(micSource);
          updateStatus('AI System Listening...');
        }
      } catch (err) {
        console.error('Mic Access Denied:', err);
        updateStatus('Mic Error');
      }

      if (state.avatarType === 'ai') startWebSocket();
      if (active) updateStatus('System Live');
    };

    startup();
    return () => { active = false; };
  }, []);

  const handleImageError = () => {
    if (!avatarImageRef.current) return;
    const src = avatarImageRef.current.src;
    if (src.endsWith('/e.png')) {
      avatarImageRef.current.src = src.replace('/e.png', '/a.png');
    } else if (src.endsWith('/o.png')) {
      avatarImageRef.current.src = src.replace('/o.png', '/u.png');
    } else {
      // Fatal error: set opacity as visual feedback
      avatarImageRef.current.style.opacity = '0.5';
    }
  };

  const toggleMute = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (micTrackRef.current) micTrackRef.current.enabled = !nextMuted;
    updateStatus(nextMuted ? 'Muted' : 'Mic Active');

    const s = await window.electronAPI.getSettings();
    if (!s.vad) s.vad = {};
    s.vad.start_muted = nextMuted;
    await window.electronAPI.saveSettings(s);
  };

  const toggleMode = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const s = await window.electronAPI.getSettings();
    if (!s.user_profile) s.user_profile = {};

    const currentMode = s.user_profile.mode || 'soliloquy';
    const nextMode = currentMode === 'soliloquy' ? 'conversation' : 'soliloquy';

    updateStatus(`Mode: ${nextMode}`);
    s.user_profile.mode = nextMode;
    await window.electronAPI.saveSettings(s);
    // Note: applySettings via onSettingsChanged will update the local UI state
  };

  const toggleLock = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextLocked = !isLocked;

    // Captured bounds to prevent "jump" when locking
    let currentBounds = null;
    if (nextLocked) {
      currentBounds = await window.electronAPI.getWindowBounds();
    }

    setIsLocked(nextLocked);
    window.electronAPI.setResizable(!nextLocked);

    const s = await window.electronAPI.getSettings();
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

    await window.electronAPI.saveSettings(s);
  };

  return (
    <>
      <div
        className={`avatar-container ${!visible ? 'hidden' : ''} ${viewMode === 'wide' ? 'wide-view' : ''}`}
        data-testid="avatar-container"
      >
        <img
          ref={avatarImageRef}
          id="avatar-image"
          className={`avatar-main ${isFlipped ? 'flipped' : ''}`}
          onError={handleImageError}
          draggable={false}
        />
        <div
          ref={statusDebugRef}
          id="status-debug"
          style={{
            position: 'fixed',
            bottom: '4px',
            left: '4px',
            color: 'white',
            background: 'rgba(0,0,0,0.75)',
            padding: '2px 5px',
            borderRadius: '4px',
            fontSize: '9px',
            pointerEvents: 'none',
            zIndex: 100,
            fontFamily: 'monospace',
            whiteSpace: 'pre',
          }}
        >
          Initializing...
        </div>

        <div className="controls-wrapper" data-corner={controlCorner}>
          <button
            className={`control-button ${isLocked ? 'active' : ''}`}
            onClick={toggleLock}
            title={isLocked ? "移動ロックを解除" : "位置をロック"}
          >
            {isLocked ? '🔒' : '🔓'}
          </button>

          {state.avatarType === 'ai' && (
            <button
              className={`control-button ${mode === 'conversation' ? 'active' : ''}`}
              onClick={toggleMode}
              style={{ fontSize: '14px' }}
              title={mode === 'conversation' ? "対話モード (おしゃべり中)" : "独り言モード (見守り中)"}
            >
              {mode === 'conversation' ? '💬' : '👁️'}
            </button>
          )}

          {state.avatarType === 'user' && (
            <button
              className={`control-button ${isMuted ? 'active' : ''}`}
              onClick={toggleMute}
              title={isMuted ? "マイクはミュートされています" : "マイクはオンです"}
            >
              {isMuted ? '🔇' : '🎤'}
            </button>
          )}
        </div>
      </div>
    </>
  );
};
