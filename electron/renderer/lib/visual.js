/**
 * Parcera: Visual / Animation Engine
 *
 * Handles avatar rendering: blinking, mouth shapes (lip-sync),
 * debug overlay, and the requestAnimationFrame loop.
 */
import { state } from './state.js';
import { getRMS, getVowel } from './audio.js';

// --- Constants ---
const BLINK_CLOSE_DURATION = 150; // ms — eyes stay shut this long
const DEFAULT_BLINK_MIN = 5000;
const DEFAULT_BLINK_MAX = 15000;
const DEFAULT_MOUTH_HOLD = 120; // ms — minimum time a mouth shape is held

// --- Module State ---
let avatarImage = null;
let statusDebug = null;
let blinkTimer = Date.now() + 2000;
let isBlinking = false;
let currentMouthFile = 'base.png';
let mouthHoldTimer = 0;

// --- Public API ---
export function initVisual(imageEl, debugEl) {
  avatarImage = imageEl;
  statusDebug = debugEl;
  updateVisuals(); // kick off the animation loop
}

// --- Animation Loop (called every frame) ---
function updateVisuals() {
  const rms = getRMS();
  const vowel = rms > state.threshold ? (getVowel() || '?') : '-';

  // Debug overlay
  if (statusDebug) {
    const showDebug = state.settings.avatars?.show_debug !== false;
    statusDebug.style.display = showDebug ? 'block' : 'none';
    const debugInfo = showDebug ? `\nRMS: ${rms.toFixed(1)} | Vowel: ${vowel}` : '';
    statusDebug.innerText = state.persistentStatus + debugInfo;
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
  const assetsDir = state.settings.avatars?.[state.avatarType]?.assets_dir || `/assets/${state.avatarType}`;
  const targetPath = `${assetsDir}/${targetFile}`;

  if (avatarImage && avatarImage.src !== window.location.origin + targetPath) {
    avatarImage.src = targetPath;
  }

  requestAnimationFrame(updateVisuals);
}
