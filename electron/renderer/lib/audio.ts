/**
 * Parcera: Audio Analysis Engine
 *
 * Manages AudioContext, RMS volume detection, and vowel classification
 * via spectral centroid analysis.
 */
import { state, logStatus } from './state';

// --- Constants ---
const FFT_SIZE = 512;
const SMOOTHING_TIME_CONSTANT = 0.2;
const AI_RMS_BOOST = 1.5;
const SILENCE_AMPLITUDE_FLOOR = 0.001;
const LOW_FREQ_CUTOFF = 200; // Hz — ignore rumble below this

/** Vowel spectral centroid boundaries (normalized 0.0–1.0) */
const VOWEL_BOUNDARIES = { u: 0.04, o: 0.10, a: 0.20, e: 0.35 } as const;

export type Vowel = 'a' | 'i' | 'u' | 'e' | 'o';

// --- Module State ---
let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
const fData = new Float32Array(FFT_SIZE / 2);
const tData = new Float32Array(FFT_SIZE);

// --- Public Accessors ---
export function getContext(): AudioContext | null { return audioContext; }
export function getAnalyser(): AnalyserNode | null { return analyser; }

// --- Initialization ---
export function initAudioContext(): void {
  if (audioContext) return;
  try {
    // AI window uses a specific sample rate to match server-side TTS audio
    const aiSampleRate = state.settings.electron?.ai_audio_sample_rate || 16000;
    const options: AudioContextOptions = state.avatarType === 'ai' ? { sampleRate: aiSampleRate } : {};
    audioContext = new AudioContext(options);

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
export function getRMS(): number {
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
export function getVowel(): Vowel | null {
  if (!analyser || !audioContext) return null;
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
