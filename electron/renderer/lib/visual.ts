/**
 * Parcera: Visual / Animation Engine
 *
 * Handles avatar rendering: blinking, mouth shapes (lip-sync),
 * debug overlay, and the requestAnimationFrame loop.
 */
import { state } from './state';
import { getRMS, getEnvelope, getVowel, TALK_THRESHOLD } from './audio';

// --- Constants ---
const BLINK_CLOSE_DURATION = 150; // ms — eyes stay shut this long
const DEFAULT_BLINK_MIN = 5000;
const DEFAULT_BLINK_MAX = 15000;
const DEFAULT_MOUTH_HOLD = 120; // ms — minimum time a mouth shape is held

// --- Module State ---
let avatarImage: HTMLImageElement | null = null;
let statusDebug: HTMLElement | null = null;
let blinkTimer = Date.now() + 2000;
let isBlinking = false;
let currentMouthFile = 'base.png';
let mouthHoldTimer = 0;

// Natural Breathing State
let breatheTime = 0;
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

  // --- Audio Analysis ---
  const env = getEnvelope();  // Normalized 0–1, auto-adapting
  const rmsRaw = getRMS();    // Raw linear for dB meter
  const vowel = env > TALK_THRESHOLD ? (getVowel() || '?') : '-';

  // Debug overlay
  if (statusDebug) {
    const showDebug = state.settings.avatars?.show_debug !== false;
    statusDebug.style.display = showDebug ? 'block' : 'none';
    if (showDebug) {
      const db = 20 * Math.log10(Math.max(rmsRaw, 0.00001)); // floor at -100dB

      // Peak meter (0 to 15 blocks, -60dB to 0dB)
      const meterSize = 15;
      const dbRange = 60;
      const normalizedLevel = Math.max(0, Math.min(1, (db + dbRange) / dbRange));
      const blocksOn = Math.floor(normalizedLevel * meterSize);

      const thresholdLevel = Math.max(0, Math.min(1, (state.threshold_db + dbRange) / dbRange));
      const thresholdPos = Math.floor(thresholdLevel * meterSize);

      let meterHtml = '';
      for (let i = 0; i < meterSize; i++) {
        if (i === thresholdPos) {
          meterHtml += '<span style="color: #ff0; font-weight: bold;">|</span>';
        } else if (i < blocksOn) {
          let color = '#eee'; // Default White
          if (db >= -3) color = '#f44'; // Peak Red
          else if (env > TALK_THRESHOLD) color = '#4f4'; // Active Green
          else color = '#999'; // Below threshold Grey

          meterHtml += `<span style="color: ${color}">█</span>`;
        } else {
          meterHtml += '<span style="color: #444">░</span>';
        }
      }

      // Show envelope percentage alongside dB for clarity
      const envPct = (env * 100).toFixed(0);
      statusDebug.innerHTML = `${state.persistentStatus}<br>[${meterHtml}] ${db.toFixed(1)}dB | Env: ${envPct}% | Vowel: ${vowel}`;
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
        nextMouth = `${vowel}.png`;
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

  const resolvedAssetsDir = ((window as any).electronAPI?.resolveLocalPath)
    ? (window as any).electronAPI.resolveLocalPath(rawAssetsDir)
    : rawAssetsDir;

  const targetPath = `${resolvedAssetsDir}/${targetFile}`;

  if (avatarImage) {
    // Robust resolution for both http:// and file://
    const absoluteTarget = new URL(targetPath, window.location.href).href;

    if (avatarImage.src !== absoluteTarget) {
      avatarImage.src = targetPath;
    }
  }

  requestAnimationFrame(updateVisuals);
}
