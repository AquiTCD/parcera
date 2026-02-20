import React, { useEffect, useRef, useState } from 'react';
import { state, logStatus } from '../lib/state';
import type { AvatarType, AvatarConfig, ParceraSettings } from '../lib/state';
import { initAudioContext, getContext, getAnalyser } from '../lib/audio';
import { initVisual } from '../lib/visual';
import { startWebSocket, setupMicStreaming } from '../lib/comm';

// Initialize global state.avatarType immediately upon module execution
const params = new URLSearchParams(window.location.search);
state.avatarType = (params.get('type') as AvatarType) || 'user';
console.log('[Parcera] Avatar Type Initialized:', state.avatarType);

export const Avatar: React.FC = () => {
  const avatarImageRef = useRef<HTMLImageElement>(null);
  const statusDebugRef = useRef<HTMLDivElement>(null);
  const [initialized, setInitialized] = useState(false);

  // Helper to update status directly in UI to avoid full component re-renders
  const updateStatus = (text: string) => {
    if (statusDebugRef.current) statusDebugRef.current.textContent = text;
  };

  // Initialize Visual Loop
  useEffect(() => {
    if (avatarImageRef.current && statusDebugRef.current) {
      initVisual(avatarImageRef.current, statusDebugRef.current);
    }
  }, []);

  // Settings Handling
  useEffect(() => {
    const applySettings = (settings: ParceraSettings) => {
      state.settings = settings;

      // Unified threshold: dB → RMS×100
      const volumeDb = settings.vad?.volume_db_threshold ?? -20;
      state.threshold = Math.pow(10, volumeDb / 20) * 100;

      // Breathe animation CSS variables
      const bScale = settings.avatars?.breathe_scale || 1.005;
      const bAmp = settings.avatars?.breathe_amplitude || 2;
      const bDur = settings.avatars?.breathe_duration || 5000;
      document.documentElement.style.setProperty('--breathe-scale', String(bScale));
      document.documentElement.style.setProperty('--breathe-amplitude', `${bAmp}px`);
      document.documentElement.style.setProperty('--breathe-duration', `${bDur}ms`);

      // Avatar image
      const avatarConfig = settings.avatars?.[state.avatarType] as AvatarConfig | undefined;
      const assetsDir = avatarConfig?.assets_dir || `/assets/${state.avatarType}`;
      if (avatarImageRef.current) {
        avatarImageRef.current.src = `${assetsDir}/base.png`;
      }

      // Ref: Removed automatic resize to match image naturalWidth/Height
      // because it causes unexpected UI jumps when saving settings.
    };

    window.electronAPI.getSettings().then((settings: ParceraSettings) => {
      applySettings(settings);
      updateStatus('Settings Loaded');
    }).catch((e: any) => {
      console.error('Settings error:', e);
      if (avatarImageRef.current) {
        avatarImageRef.current.src = `/assets/${state.avatarType}/base.png`;
      }
      updateStatus('Using Defaults');
    });

    window.electronAPI.onSettingsChanged((settings: ParceraSettings) => {
      applySettings(settings);
      updateStatus('Settings Reloaded');
      console.log('[Parcera] Settings hot-reloaded');
    });
  }, []);

  const handleInteraction = async (e: React.MouseEvent | React.TouchEvent) => {
    if (initialized) return;
    e.stopPropagation();

    setInitialized(true);

    updateStatus('Initializing Audio...');
    initAudioContext();
    const ctx = getContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') await ctx.resume();

    // Microphone
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
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
      updateStatus('Mic Error: ' + (err instanceof Error ? err.message : String(err)));
    }

    if (state.avatarType === 'ai') startWebSocket();
    updateStatus('System Live');
  };

  const handleImageError = () => {
    if (!avatarImageRef.current) return;
    const src = avatarImageRef.current.src;
    if (src.endsWith('/e.png')) avatarImageRef.current.src = src.replace('/e.png', '/a.png');
    else if (src.endsWith('/o.png')) avatarImageRef.current.src = src.replace('/o.png', '/u.png');
  };

  return (
    <>
      {!initialized && (
        <div
          id="interaction-layer"
          onClick={handleInteraction}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 999,
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <div style={{ color: 'white', background: 'rgba(0,0,0,0.5)', padding: '20px', borderRadius: '10px', fontFamily: 'sans-serif' }}>
            Click anywhere to start Avatar
          </div>
        </div>
      )}
      <div className="avatar-container">
        <img
          ref={avatarImageRef}
          id="avatar-image"
          className="avatar-main"
          src=""
          onError={handleImageError}
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
      </div>
    </>
  );
};
