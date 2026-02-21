/**
 * Parcera: Visual / Animation Engine
 *
 * Handles avatar rendering: blinking, mouth shapes (lip-sync),
 * debug overlay, and the requestAnimationFrame loop.
 */
import { state } from './state';
import { getRMS, getVowel } from './audio';

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

// --- Public API ---
export function initVisual(imageEl: HTMLImageElement, debugEl: HTMLElement): void {
  avatarImage = imageEl;
  statusDebug = debugEl;
  updateVisuals();
}

// --- Animation Loop (called every frame) ---
function updateVisuals(): void {
  const rms = getRMS();
  const vowel = rms > state.threshold ? (getVowel() || '?') : '-';

  // Debug overlay
  if (statusDebug) {
    const showDebug = state.settings.avatars?.show_debug !== false;
    statusDebug.style.display = showDebug ? 'block' : 'none';
    if (showDebug) {
      const linearRms = rms / 100;
      const db = 20 * Math.log10(Math.max(linearRms, 0.00001)); // floor at -100dB

      // Peak meter (0 to 12 blocks, -60dB to 0dB)
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
          else if (db >= state.threshold_db) color = '#4f4'; // Active Green
          else color = '#999'; // Below threshold Grey

          meterHtml += `<span style="color: ${color}">█</span>`;
        } else {
          meterHtml += '<span style="color: #444">░</span>';
        }
      }

      statusDebug.innerHTML = `${state.persistentStatus}<br>[${meterHtml}] ${db.toFixed(1)}dB | Vowel: ${vowel}`;
    }
  }

  let targetFile = 'base.png';
  const now = Date.now();

  // --- Blinking ---
  if (now > blinkTimer) {
    if (!isBlinking) {
      isBlinking = true;
      blinkTimer = now + BLINK_CLOSE_DURATION;
    } else {
      isBlinking = false;
      const min = state.settings.avatars?.blink_interval_min || DEFAULT_BLINK_MIN;
      const max = state.settings.avatars?.blink_interval_max || DEFAULT_BLINK_MAX;
      blinkTimer = now + min + Math.random() * (max - min);
    }
  }

  if (isBlinking) {
    targetFile = 'closed.png';
  } else {
    // --- Mouth (lip-sync with hold timer) ---
    const holdTime = state.settings.avatars?.mouth_hold_time || DEFAULT_MOUTH_HOLD;

    if (now > mouthHoldTimer) {
      let nextMouth = 'base.png';
      if (rms > state.threshold && vowel && vowel !== '?') {
        nextMouth = `${vowel}.png`;
      }
      if (nextMouth !== currentMouthFile) {
        currentMouthFile = nextMouth;
        mouthHoldTimer = now + holdTime;
      }
    }
    targetFile = currentMouthFile;
  }

  // --- Apply image ---
  const avatarConfig = state.settings.avatars?.[state.avatarType];
  const rawAssetsDir = (typeof avatarConfig === 'object' && avatarConfig?.assets_dir)
    ? avatarConfig.assets_dir
    : `/assets/${state.avatarType}`;

  const resolvedAssetsDir = ((window as any).electronAPI?.resolveLocalPath)
    ? (window as any).electronAPI.resolveLocalPath(rawAssetsDir)
    : rawAssetsDir;

  const targetPath = `${resolvedAssetsDir}/${targetFile}`;

  if (avatarImage) {
    // Only update if the full resolved URL is different
    const currentSrc = avatarImage.src;
    const absoluteTarget = targetPath.includes('://')
      ? targetPath
      : window.location.origin + targetPath;

    if (currentSrc !== absoluteTarget) {
      avatarImage.src = targetPath;
    }
  }

  requestAnimationFrame(updateVisuals);
}
