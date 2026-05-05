/**
 * Parcera: Visual / Animation Engine
 *
 * Handles avatar rendering: blinking, mouth shapes (lip-sync),
 * debug overlay, and the requestAnimationFrame loop.
 */
import { state } from './state';
import { getRMS, getEnvelope, getVowel, getExternalLipsync, TALK_THRESHOLD, getContext } from './audio';
import { api } from './api';

// --- Constants ---
const BLINK_CLOSE_DURATION = 150; // ms — eyes stay shut this long
const DEFAULT_BLINK_MIN = 5000;
const DEFAULT_BLINK_MAX = 15000;
const DEFAULT_MOUTH_HOLD = 120; // ms — minimum time a mouth shape is held

// Vowels that map to a non-standard filename (e.g. nasal → closed mouth)
const VOWEL_FILE_OVERRIDE: Partial<Record<string, string>> = {
  n: 'base.png', // ん: nasal consonant, mouth stays closed
};

// --- Module State ---
let avatarImage: HTMLImageElement | null = null;
let statusDebug: HTMLElement | null = null;
let blinkTimer = Date.now() + 2000;
let isBlinking = false;
let currentMouthFile = 'base.png';
let mouthHoldTimer = 0;

// Natural Breathing State
// Initialize with random offset to prevent synchronization between different windows
let breatheTime = Math.random() * 100;
let lastFrameTime = performance.now();

// --- Public API ---
export function initVisual(imageEl: HTMLImageElement, debugEl: HTMLElement): void {
  avatarImage = imageEl;
  statusDebug = debugEl;
  lastFrameTime = performance.now(); // Reset on init
  updateVisuals();
}

// --- Animation Loop (called every frame) ---
function updateVisuals(): void {
  const now = performance.now();
  const deltaTime = (now - lastFrameTime) / 1000; // seconds
  lastFrameTime = now;

  // --- Natural Breathing Calculation ---
  const duration = state.settings.avatars?.breathe_duration || 5000;
  const bScale = state.settings.avatars?.breathe_scale || 1.005;
  const bAmp = state.settings.avatars?.breathe_amplitude || 2;

  // Speed: mapping duration (ms) to radian progress.
  // Base cycle speed (e.g. 5000ms = 0.2Hz = 1.25 rad/sec)
  const speedScale = (2 * Math.PI) / (duration / 1000);
  breatheTime += deltaTime * speedScale;

  // Fluctuating wave: sin(t) + 0.5 * sin(t * GOLDEN_RATIO)
  // Max possible value is ~1.5, min is ~-1.5
  const wave = Math.sin(breatheTime) + 0.5 * Math.sin(breatheTime * 1.618);
  const normalizedWave = wave / 1.5;

  const currentY = (normalizedWave + 1) * 0.5 * bAmp; // 0 to bAmp
  const currentScale = 1 + (Math.max(0, normalizedWave) * (bScale - 1)); // 1 to bScale

  if (avatarImage) {
    avatarImage.style.setProperty('--breathe-offset-y', `${currentY}px`);
    avatarImage.style.setProperty('--breathe-current-scale', `${currentScale}`);
  }

  // --- Audio Analysis (or external lipsync driven by Python MicAnalyzer) ---
  const extLipsync = getExternalLipsync();
  const env = extLipsync !== null ? extLipsync.env : getEnvelope();
  const rmsRaw = extLipsync !== null ? extLipsync.rawAmplitude : getRMS(); // raw Python RMS for dB meter
  const vowel = extLipsync !== null
    ? (extLipsync.env > TALK_THRESHOLD ? (extLipsync.vowel || '-') : '-')
    : (env > TALK_THRESHOLD ? (getVowel() || '?') : '-');

  // Debug overlay
  if (statusDebug) {
    const showDebug = state.settings.avatars?.show_debug !== false;
    statusDebug.style.display = showDebug ? 'block' : 'none';
    if (showDebug) {
      const db = 20 * Math.log10(Math.max(rmsRaw, 0.00001)); // floor at -100dB

      // Peak meter (0 to 15 blocks, -55dB to -5dB)
      // Range tuned for Python raw capture levels: typical speech sits at
      // -25 to -45 dBFS, placing it in the center of the meter so the
      // threshold marker is easy to read and calibrate.
      const meterSize = 15;
      const DB_FLOOR = -55;
      const DB_CEIL = -5;
      const dbSpan = DB_CEIL - DB_FLOOR; // 50 dB
      const normalizedLevel = Math.max(0, Math.min(1, (db - DB_FLOOR) / dbSpan));
      const blocksOn = Math.floor(normalizedLevel * meterSize);

      const thresholdLevel = Math.max(0, Math.min(1, (state.threshold_db - DB_FLOOR) / dbSpan));
      const thresholdPos = Math.floor(thresholdLevel * meterSize);

      let meterHtml = '';
      for (let i = 0; i < meterSize; i++) {
        if (i === thresholdPos) {
          meterHtml += '<span style="color: #ff0; font-weight: bold;">|</span>';
        } else if (i < blocksOn) {
          let color = '#eee'; // Default White
          if (db >= DB_CEIL) color = '#f44'; // Peak Red (at ceiling)
          else if (env > TALK_THRESHOLD) color = '#4f4'; // Active Green
          else color = '#999'; // Below threshold Grey

          meterHtml += `<span style="color: ${color}">█</span>`;
        } else {
          meterHtml += '<span style="color: #444">░</span>';
        }
      }

      // Show envelope percentage alongside dB for clarity
      const envPct = (env * 100).toFixed(0);
      const ctxState = getContext()?.state ?? 'null';
      statusDebug.innerHTML = `${state.persistentStatus}<br>[${meterHtml}] ${db.toFixed(1)}dB | Env: ${envPct}% | Vowel: ${vowel} | ctx:${ctxState}`;
    }
  }

  let targetFile = 'base.png';
  const nowMs = Date.now(); // Blinking still uses Date.now() for ease of timer comparison with Date.now() + duration

  // --- Blinking ---
  if (nowMs > blinkTimer) {
    if (!isBlinking) {
      isBlinking = true;
      blinkTimer = nowMs + BLINK_CLOSE_DURATION;
    } else {
      isBlinking = false;
      const min = state.settings.avatars?.blink_interval_min || DEFAULT_BLINK_MIN;
      const max = state.settings.avatars?.blink_interval_max || DEFAULT_BLINK_MAX;
      blinkTimer = nowMs + min + Math.random() * (max - min);
    }
  }

  if (isBlinking) {
    targetFile = 'closed.png';
  } else {
    // --- Mouth (lip-sync with hold timer) ---
    const holdTime = state.settings.avatars?.mouth_hold_time || DEFAULT_MOUTH_HOLD;

    if (nowMs > mouthHoldTimer) {
      let nextMouth = 'base.png';
      if (env > TALK_THRESHOLD && vowel && vowel !== '?') {
        nextMouth = VOWEL_FILE_OVERRIDE[vowel] ?? `${vowel}.png`;
      }
      if (nextMouth !== currentMouthFile) {
        currentMouthFile = nextMouth;
        mouthHoldTimer = nowMs + holdTime;
      }
    }
    targetFile = currentMouthFile;
  }

  // --- Apply image ---
  const avatarConfig = state.settings.avatars?.[state.avatarType];
  const rawAssetsDir = (typeof avatarConfig === 'object' && avatarConfig?.assets_dir)
    ? avatarConfig.assets_dir
    : `assets/${state.avatarType}`;

  const resolvedAssetsDir = api.resolveLocalPath(rawAssetsDir);

  const targetPath = `${resolvedAssetsDir}/${targetFile}`;

  if (avatarImage) {
    // Robust resolution for both http:// and file://
    const absoluteTarget = new URL(targetPath, window.location.href).href;

    if (avatarImage.src !== absoluteTarget) {
      avatarImage.src = targetPath;
      // Reset internal state when the image fails to load (e.g. a custom avatar
      // missing a vowel sprite). Without this, visual.ts and handleImageError
      // fight each other every frame, causing a visible flicker loop.
      avatarImage.onerror = () => {
        if (targetFile !== 'base.png' && targetFile !== 'closed.png') {
          currentMouthFile = 'base.png';
          mouthHoldTimer = 0;
        }
        avatarImage!.onerror = null;
      };
    }
  }

  // Use setTimeout when the tab is hidden — rAF is throttled to ≤1 fps in
  // background tabs and OBS browser sources, making the flicker loop visible.
  if (document.hidden) {
    setTimeout(updateVisuals, 33); // ~30 fps
  } else {
    requestAnimationFrame(updateVisuals);
  }
}
