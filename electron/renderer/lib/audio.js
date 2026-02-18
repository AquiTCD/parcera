/**
 * Parcera: Audio Analysis Engine
 *
 * Manages AudioContext, RMS volume detection, and vowel classification
 * via spectral centroid analysis. All magic numbers are named constants.
 */
import { state, logStatus } from './state.js';

// --- Constants ---
const FFT_SIZE = 512;
const SMOOTHING_TIME_CONSTANT = 0.2;
const AI_RMS_BOOST = 1.5;
const SILENCE_AMPLITUDE_FLOOR = 0.001;
const LOW_FREQ_CUTOFF = 200; // Hz — ignore rumble below this

// Vowel spectral centroid boundaries (normalized 0.0–1.0)
const VOWEL_BOUNDARIES = { u: 0.04, o: 0.10, a: 0.20, e: 0.35 };

// --- Module State ---
let audioContext = null;
let analyser = null;
const fData = new Float32Array(FFT_SIZE / 2);
const tData = new Float32Array(FFT_SIZE);

// --- Public Accessors ---
export function getContext() { return audioContext; }
export function getAnalyser() { return analyser; }

// --- Initialization ---
export function initAudioContext() {
  if (audioContext) return;
  try {
    // AI window uses 16 kHz to match server-side TTS audio
    const options = state.avatarType === 'ai' ? { sampleRate: 16000 } : {};
    audioContext = new (window.AudioContext || window.webkitAudioContext)(options);

    analyser = audioContext.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = SMOOTHING_TIME_CONSTANT;
    logStatus(`Audio System: ${audioContext.sampleRate}Hz`);
  } catch (e) {
    console.error('AudioContext error:', e);
    logStatus('Audio Init Failed');
  }
}

// --- RMS Volume ---
export function getRMS() {
  if (!analyser) return 0;
  analyser.getFloatTimeDomainData(tData);
  let sum = 0;
  for (let i = 0; i < tData.length; i++) {
    sum += tData[i] * tData[i];
  }
  let rms = Math.sqrt(sum / tData.length) * 100;
  // AI playback is often cleaner/quieter — boost for lip-sync visibility
  if (state.avatarType === 'ai' && state.isAIPlaying) rms *= AI_RMS_BOOST;
  return rms;
}

// --- Vowel Detection (Spectral Centroid → Japanese Vowel) ---
export function getVowel() {
  if (!analyser) return null;
  analyser.getFloatFrequencyData(fData);

  const nyquist = audioContext.sampleRate / 2;
  let weightedFreqSum = 0;
  let totalAmplitude = 0;

  for (let i = 0; i < fData.length; i++) {
    const amplitude = Math.pow(10, fData[i] / 20); // dB → linear
    const freq = (i / fData.length) * nyquist;
    if (freq > LOW_FREQ_CUTOFF) {
      weightedFreqSum += amplitude * freq;
      totalAmplitude += amplitude;
    }
  }

  if (totalAmplitude < SILENCE_AMPLITUDE_FLOOR) return null;

  const centroid = weightedFreqSum / totalAmplitude;
  const centroid01 = Math.min(1, centroid / nyquist);

  if (centroid01 < VOWEL_BOUNDARIES.u) return 'u';
  if (centroid01 < VOWEL_BOUNDARIES.o) return 'o';
  if (centroid01 < VOWEL_BOUNDARIES.a) return 'a';
  if (centroid01 < VOWEL_BOUNDARIES.e) return 'e';
  return 'i';
}
