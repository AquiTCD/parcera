/**
 * Parcera: Audio Analysis Engine
 *
 * Manages AudioContext, RMS volume detection, envelope normalization,
 * and vowel classification via spectral centroid analysis.
 *
 * The adaptive normalization and LPF smoothing are inspired by
 * sample/websocket/html/lipsync.js (LipSyncEngine).
 */
import { state, logStatus } from './state';

// --- Constants ---
const FFT_SIZE = 512;
const SMOOTHING_TIME_CONSTANT = 0.2;
const SILENCE_AMPLITUDE_FLOOR = 0.001;
const LOW_FREQ_CUTOFF = 200; // Hz — ignore rumble below this

/**
 * Vowel boundaries in absolute Hz (based on Japanese vowel formant ranges).
 * Using absolute Hz rather than normalized 0-1 avoids sample-rate-dependent
 * skew (User window uses ~48kHz, AI window uses 16kHz → very different nyquist).
 *
 *  u: spectral centroid below ~600Hz (dark, low-energy)
 *  o: 600–1500Hz
 *  a: 1500–3000Hz (bright, wide)
 *  e: 3000–5000Hz
 *  i: above 5000Hz (brightest)
 */
const VOWEL_BOUNDARIES_HZ = { u: 600, o: 1500, a: 3000, e: 5000 } as const;

// --- Adaptive Envelope Constants (from lipsync.js) ---
const AUDIO_HZ = 60;       // Approximate animation frame rate
const LPF_CUTOFF_HZ = 8.0; // Low-pass filter cutoff for envelope smoothing
const LPF_BETA = 1.0 - Math.exp(-2.0 * Math.PI * LPF_CUTOFF_HZ / AUDIO_HZ);
const RMS_QUEUE_MAX = 3;    // Short-term moving average window
const PEAK_DECAY = 0.995;   // How fast the tracked peak decays per frame

/**
 * Hard noise gate: raw RMS below this linear amplitude is forced to envelope=0.
 * This prevents the adaptive normalization from amplifying ambient noise into
 * false lip-sync triggers. Derived from settings (vad.volume_db_threshold) at runtime.
 */
let noiseGateLinear = Math.pow(10, -20 / 20); // default -20dB → ~0.1

/** Minimum envelope level to consider "talking" (auto-calibrated baseline) */
export const TALK_THRESHOLD = 0.06;

export type Vowel = 'a' | 'i' | 'u' | 'e' | 'o';

// --- Module State ---
let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let currentAnalyserSource: AudioNode | null = null;
const fData = new Float32Array(FFT_SIZE / 2);
const tData = new Float32Array(FFT_SIZE);

// --- Adaptive Normalization State ---
const normalization = {
  noise: 1e-4,   // Tracked noise floor (adapts slowly)
  peak: 1e-3,    // Tracked signal peak (decays via PEAK_DECAY)
};

const smoothing = {
  rmsQueue: [] as number[], // Short-term moving average buffer
  envLP: 0,                 // Low-pass filtered envelope
};

// --- Public Accessors ---
export function getContext(): AudioContext | null { return audioContext; }
export function getAnalyser(): AnalyserNode | null { return analyser; }

/**
 * Safely connect a node to the analyser, disconnecting any previous source.
 */
export function connectToAnalyser(source: AudioNode): void {
  if (!analyser) return;
  if (currentAnalyserSource) {
    try {
      currentAnalyserSource.disconnect(analyser);
    } catch (e) { /* ignore */ }
  }
  currentAnalyserSource = source;
  source.connect(analyser);
}

// --- Initialization ---
export function initAudioContext(): void {
  if (audioContext) return;
  try {
    // Force 16000Hz for both windows.
    // AI window: Matches raw TTS PCM from server.
    // User window: Automatically handles hardware (48k) -> AI (16k) resampling.
    // This ensures PCM data sent to Python is exactly 16000 samples per second.
    const sampleRate = state.settings.electron?.ai_audio_sample_rate || 16000;
    const options: AudioContextOptions = {
      sampleRate,
      latencyHint: 'interactive'
    };
    audioContext = new AudioContext(options);

    analyser = audioContext.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = SMOOTHING_TIME_CONSTANT;

    const actualRate = audioContext.sampleRate;
    logStatus(`Audio: ${actualRate}Hz ${state.avatarType === 'ai' ? '(AI)' : '(User)'}`);
    console.log(`[Parcera] AudioContext Initialized. Rate: ${actualRate}Hz, Type: ${state.avatarType}`);
  } catch (e) {
    console.error('AudioContext error:', e);
    logStatus('Audio Init Failed');
  }
}

// --- Raw RMS (for dB meter display) ---
/**
 * Returns the raw RMS amplitude (0–1 linear scale).
 * Use this for dB meter UI. For mouth animation, use getEnvelope() instead.
 */
export function getRMS(): number {
  if (!analyser) return 0;
  analyser.getFloatTimeDomainData(tData);
  let sum = 0;
  for (let i = 0; i < tData.length; i++) {
    sum += tData[i] * tData[i];
  }
  return Math.sqrt(sum / tData.length);
}

/**
 * Update the noise gate threshold from settings (called when settings change).
 */
export function setNoiseGateDb(db: number): void {
  noiseGateLinear = Math.pow(10, db / 20);
}

// --- Adaptive Envelope (for lip-sync) ---
/**
 * Returns a normalized, smoothed envelope value (0–1) for lip-sync decisions.
 *
 * Processing pipeline:
 * 1. Noise Gate — if raw RMS is below the absolute dB floor, return 0 immediately.
 * 2. Online Normalization — tracks noise floor and peak to auto-scale to 0–1.
 * 3. Short-term Moving Average — removes micro-jitter between frames.
 * 4. 1-pole Low-pass Filter — produces a smooth, natural-feeling envelope.
 *
 * Should be called once per animation frame.
 */
export function getEnvelope(): number {
  const rmsRaw = getRMS();

  // --- Stage 0: Hard Noise Gate ---
  // Below this absolute level, nothing passes. Prevents adaptive normalization
  // from amplifying ambient noise (fans, AC) into false lip-sync triggers.
  if (rmsRaw < noiseGateLinear) {
    // Still update smoothing state to avoid a "pop" when gate opens
    smoothing.rmsQueue.push(0);
    if (smoothing.rmsQueue.length > RMS_QUEUE_MAX) smoothing.rmsQueue.shift();
    smoothing.envLP *= 0.9; // Gentle decay instead of hard cut
    return Math.max(smoothing.envLP, 0);
  }

  // --- Stage 1: Online Normalization ---
  // Track the noise floor: adapt quickly when signal is near/below floor,
  // slowly otherwise (prevents speech from inflating the floor).
  if (rmsRaw < normalization.noise + 0.0005) {
    normalization.noise = 0.99 * normalization.noise + 0.01 * rmsRaw;
  } else {
    normalization.noise = 0.999 * normalization.noise + 0.001 * rmsRaw;
  }

  // Track the peak with exponential decay
  normalization.peak = Math.max(rmsRaw, normalization.peak * PEAK_DECAY);

  // Normalize to 0–1 range, with sqrt compression for perceptual scaling
  const denom = Math.max(normalization.peak - normalization.noise, 1e-6);
  const rmsNorm = Math.pow(clamp((rmsRaw - normalization.noise) / denom, 0, 1), 0.5);

  // --- Stage 2: Short-term Moving Average ---
  smoothing.rmsQueue.push(rmsNorm);
  if (smoothing.rmsQueue.length > RMS_QUEUE_MAX) smoothing.rmsQueue.shift();
  const rmsSm = smoothing.rmsQueue.reduce((a, b) => a + b, 0) / smoothing.rmsQueue.length;

  // --- Stage 3: 1-pole Low-pass Filter ---
  smoothing.envLP += LPF_BETA * (rmsSm - smoothing.envLP);

  // Blend: 75% filtered + 25% immediate for responsiveness
  return clamp(0.75 * smoothing.envLP + 0.25 * rmsSm, 0, 1);
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

  // Use absolute Hz centroid (not normalized) to avoid sample-rate skew
  const centroid = weightedFreqSum / totalAmplitude;

  if (centroid < VOWEL_BOUNDARIES_HZ.u) return 'u';
  if (centroid < VOWEL_BOUNDARIES_HZ.o) return 'o';
  if (centroid < VOWEL_BOUNDARIES_HZ.a) return 'a';
  if (centroid < VOWEL_BOUNDARIES_HZ.e) return 'e';
  return 'i';
}

// --- Utility ---
function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}
