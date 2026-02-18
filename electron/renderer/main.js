/**
 * Parcera: Renderer Entry Point
 *
 * Thin orchestrator — wires together state, audio, visual, and comm modules.
 * Only UI creation, settings loading, and user-gesture activation live here.
 */
import './style.css';
import { state, logStatus } from './lib/state.js';
import { initAudioContext, getContext, getAnalyser } from './lib/audio.js';
import { initVisual } from './lib/visual.js';
import { startWebSocket, setupMicStreaming } from './lib/comm.js';

console.log('[Parcera] Renderer process starting...');

// --- Determine Window Type ---
const params = new URLSearchParams(window.location.search);
state.avatarType = params.get('type') || 'user';
console.log('[Parcera] Avatar Type:', state.avatarType);

// --- UI Scaffold ---
const app = document.querySelector('#app');
app.innerHTML = `
  <div id="interaction-layer" style="position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:999; cursor:pointer; display:flex; justify-content:center; align-items:center;">
    <div id="click-prompt" style="color:white; background:rgba(0,0,0,0.5); padding:20px; border-radius:10px; font-family:sans-serif;">
      Click anywhere to start Avatar
    </div>
  </div>
  <div class="avatar-container">
    <img id="avatar-image" class="avatar-main" src="" />
    <div id="status-debug" style="position:fixed; bottom:4px; left:4px; color:white; background:rgba(0,0,0,0.75); padding: 2px 5px; border-radius: 4px; font-size:9px; pointer-events:none; z-index:100; font-family: monospace; white-space: pre;">
      Initializing...
    </div>
  </div>
`;

const avatarImage = document.querySelector('#avatar-image');
const statusDebug = document.querySelector('#status-debug');
const interactionLayer = document.querySelector('#interaction-layer');

// --- Activation (user gesture required to unlock AudioContext) ---
const triggerInit = async (e) => {
  if (state.isInitialized) return;
  e.stopPropagation();

  state.isInitialized = true;
  interactionLayer.style.display = 'none';

  logStatus('Initializing Audio...');
  initAudioContext();
  const ctx = getContext();
  if (ctx.state === 'suspended') await ctx.resume();

  // Microphone
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    });
    const micSource = ctx.createMediaStreamSource(stream);

    if (state.avatarType === 'user') {
      micSource.connect(getAnalyser());
      logStatus('User Mic Active');
    } else {
      setupMicStreaming(micSource);
      logStatus('AI System Listening...');
    }
  } catch (err) {
    console.error('Mic Access Denied:', err);
    logStatus('Mic Error: ' + err.message);
  }

  if (state.avatarType === 'ai') startWebSocket();
  logStatus('System Live');
};

interactionLayer.addEventListener('click', triggerInit);
window.addEventListener('mousedown', triggerInit);

// --- Start Visual Loop (blinking works before activation) ---
initVisual(avatarImage, statusDebug);

// --- Load Settings ---
(async () => {
  try {
    state.settings = await window.electronAPI.getSettings();
    const config = state.settings.avatars?.[state.avatarType] || {};

    // Unified threshold: dB → RMS×100
    const volumeDb = state.settings.vad?.volume_db_threshold ?? -20;
    state.threshold = Math.pow(10, volumeDb / 20) * 100;

    // Breathe animation CSS variables
    const bScale = state.settings.avatars?.breathe_scale || 1.005;
    const bAmp = state.settings.avatars?.breathe_amplitude || 2;
    const bDur = state.settings.avatars?.breathe_duration || 5000;
    document.documentElement.style.setProperty('--breathe-scale', bScale);
    document.documentElement.style.setProperty('--breathe-amplitude', `${bAmp}px`);
    document.documentElement.style.setProperty('--breathe-duration', `${bDur}ms`);

    // Initial avatar image
    const assetsDir = config.assets_dir || `/assets/${state.avatarType}`;
    avatarImage.src = `${assetsDir}/base.png`;

    // Resize window to match image
    if (avatarImage.complete) {
      window.electronAPI.resizeWindow(avatarImage.naturalWidth, avatarImage.naturalHeight);
    }

    // Vowel fallback for missing mouth sprites
    avatarImage.onerror = () => {
      const src = avatarImage.src;
      if (src.endsWith('/e.png')) avatarImage.src = src.replace('/e.png', '/a.png');
      else if (src.endsWith('/o.png')) avatarImage.src = src.replace('/o.png', '/u.png');
    };

    logStatus('Settings Loaded');
  } catch (e) {
    console.error('Settings error:', e);
    avatarImage.src = `/assets/${state.avatarType}/base.png`;
    logStatus('Using Defaults');
  }
})();
