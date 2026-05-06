/**
 * Parcera: Communication Manager
 *
 * WebSocket connection to the Python AI server, microphone streaming
 * (PCM via AudioWorklet → Base64), sequential audio playback queue,
 * and OBS user-avatar lipsync WS subscription.
 */
import { state, logStatus } from './state';
import type { ServerMessage } from './state';
import { getContext, getAnalyser, connectToAnalyser, setExternalLipsync, clearExternalLipsync } from './audio';
import type { Vowel } from './audio';
import processorUrl from './pcm-processor.js?url';

// --- Constants ---
export const DEFAULT_PORT = 8676;

export function buildWsUrl(port: number): string {
  return `ws://127.0.0.1:${port}/ws`;
}

export function buildServerUrl(port: number, path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `http://127.0.0.1:${port}${normalizedPath}`;
}

// --- Module State ---
let socket: WebSocket | null = null;
let playbackRouteReady = false;

// --- Base64 Encoding (chunked, stack-safe) ---
const BASE64_CHUNK_SIZE = 8192;

function uint8ToBase64(uint8: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < uint8.length; offset += BASE64_CHUNK_SIZE) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(uint8.subarray(offset, offset + BASE64_CHUNK_SIZE))
    );
  }
  return btoa(binary);
}

// =====================
// Audio Playback Queue
// =====================
const audioQueue: string[] = [];
let currentSource: AudioBufferSourceNode | null = null;
let isProcessingQueue = false;

function flushAudioQueue(): void {
  audioQueue.length = 0;
  if (currentSource) {
    try {
      currentSource.onended = null; // prevent cascade
      currentSource.stop();
    } catch (_) { /* already stopped */ }
    currentSource = null;
  }
  isProcessingQueue = false;
}

function enqueueAudioChunk(base64: string): void {
  audioQueue.push(base64);
  state.isAIPlaying = true;
  if (!isProcessingQueue) {
    playNextChunk();
  }
}

async function playNextChunk(retryData?: string): Promise<void> {
  const base64 = retryData || audioQueue.shift();

  if (!base64) {
    isProcessingQueue = false;
    currentSource = null;
    state.isAIPlaying = false;
    logStatus('AI Stopped');
    return;
  }

  // Skip empty or trivially small chunks (TTS engine failure)
  if (base64.length < 100) {
    console.warn('[Parcera] Skipping empty/tiny audio chunk');
    playNextChunk();
    return;
  }

  isProcessingQueue = true;
  const audioContext = getContext();
  const analyser = getAnalyser();

  if (!audioContext || !analyser) return;

  try {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

    const audioData = await audioContext.decodeAudioData(bytes.buffer);
    const source = audioContext.createBufferSource();
    source.buffer = audioData;

    connectToAnalyser(source);
    // analyser→destination is connected once via initPlaybackRoute()

    currentSource = source;
    source.start();

    source.onended = () => {
      currentSource = null;
      playNextChunk(); // chain to next
    };
  } catch (err) {
    console.error('AI Audio Error:', err);
    currentSource = null;

    // Retry once if this wasn't already a retry
    if (!retryData) {
      console.warn('[Parcera] Retrying audio chunk decode...');
      await new Promise((r) => setTimeout(r, 50));
      playNextChunk(base64);
    } else {
      console.error('[Parcera] Audio chunk decode failed after retry, skipping');
      playNextChunk(); // skip bad chunk, continue queue
    }
  }
}

// =====================
// WebSocket
// =====================
function initPlaybackRoute(): void {
  if (playbackRouteReady) return;
  const analyser = getAnalyser();
  const audioContext = getContext();
  if (analyser && audioContext) {
    analyser.connect(audioContext.destination);
    playbackRouteReady = true;
  }
}

// --- Reconnection with Exponential Backoff ---
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;
const RECONNECT_MAX_RETRIES = 10;
let reconnectAttempt = 0;
let closingIntentionally = false;

async function checkServerHealth(port: number): Promise<boolean> {
  try {
    const res = await fetch(buildServerUrl(port, '/health'));
    return res.ok;
  } catch {
    return false;
  }
}

/** Cleanly close the existing WebSocket (if any) before opening a new one. */
function closeExistingSocket(): void {
  if (socket) {
    closingIntentionally = true;
    try {
      socket.onclose = null; // prevent triggering reconnect
      socket.onerror = null;
      socket.onmessage = null;
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close(1000, 'Reconnecting'); // Normal closure
      }
    } catch (_) { /* already closed */ }
    socket = null;
    closingIntentionally = false;
  }
}

function scheduleReconnect(): void {
  reconnectAttempt++;
  if (reconnectAttempt > RECONNECT_MAX_RETRIES) {
    logStatus(`Reconnect failed (${RECONNECT_MAX_RETRIES} attempts)`);
    return;
  }
  const delay = Math.min(RECONNECT_BASE_MS * Math.pow(2, reconnectAttempt - 1), RECONNECT_MAX_MS);
  logStatus(`Reconnecting in ${(delay / 1000).toFixed(0)}s (${reconnectAttempt}/${RECONNECT_MAX_RETRIES})...`);
  setTimeout(startWebSocket, delay);
}

export function startWebSocket(): void {
  if (state.avatarType !== 'ai') return;

  const port = state.settings.app?.port || DEFAULT_PORT;
  const wsUrl = buildWsUrl(port);

  // Skip if we are already connected or connecting to the correct URL
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    if (socket.url === wsUrl) return;
  }

  initPlaybackRoute(); // wire analyser→destination once

  // Close any stale connection before opening a new one
  closeExistingSocket();

  // Check server health before attempting WebSocket connection
  checkServerHealth(port).then((healthy) => {
    if (!healthy && reconnectAttempt > 0) {
      logStatus('Server not ready');
      scheduleReconnect();
      return;
    }

    logStatus('Connecting to AI Server...');
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      reconnectAttempt = 0; // reset on success
      logStatus('AI Server Online');
      socket?.send(JSON.stringify({ type: 'start', session_id: 'parcera-session' }));
    };

    socket.onmessage = async (event: MessageEvent) => {
      const data: ServerMessage = JSON.parse(event.data as string);
      if (data.type === 'start' || data.type === 'thinking') {
        flushAudioQueue(); // cancel old response
        state.isAIPlaying = true;
        logStatus(data.type === 'thinking' ? `Thinking: ${data.text}` : 'AI Responding...');
      } else if (data.type === 'chunk' && data.audio_data) {
        enqueueAudioChunk(data.audio_data);
      } else if (data.type === 'stop' || data.type === 'final' || data.type === 'error') {
        if (audioQueue.length === 0 && !currentSource) {
          state.isAIPlaying = false;
          logStatus('AI Stopped');
        }
        // queue not empty → let it drain naturally via playNextChunk
      }
    };

    socket.onclose = () => {
      if (closingIntentionally) return; // Don't reconnect if we closed on purpose
      logStatus('AI Connection Lost');
      scheduleReconnect();
    };

    socket.onerror = () => {
      logStatus('AI Connection Error');
      scheduleReconnect();
    };
  });
}

// =====================
// Mic Streaming (AudioWorklet — off main thread)
// =====================
// --- Mic Streaming State ---
let currentMicSource: MediaStreamAudioSourceNode | null = null;
let currentWorkletNode: AudioWorkletNode | null = null;
// Monotonic counter: incremented on each call so that if a newer call arrives
// while `await addModule` is pending, the older call self-aborts after the
// await rather than creating a stale worklet that double-sends PCM to Python.
let micSetupGen = 0;

// =====================
// OBS Server Watcher
// =====================

/**
 * In OBS browser-source mode, poll the Python server health endpoint.
 * When the server goes down and comes back (i.e. Parcera was restarted),
 * reload the page so every WebSocket and settings fetch starts fresh.
 *
 * The watcher runs for the lifetime of the page — no cleanup needed.
 */
export function startObsServerWatcher(): void {
  const port = state.settings.app?.port || DEFAULT_PORT;
  let wasDown = false;

  const tick = async () => {
    const healthy = await checkServerHealth(port);
    if (!healthy) {
      wasDown = true;
    } else if (wasDown) {
      // Server just recovered — reload to re-init WS, settings, and audio.
      location.reload();
      return;
    }
    setTimeout(tick, 3000);
  };

  // Kick off the first check after a short delay to avoid racing with startup.
  setTimeout(tick, 5000);
}

// =====================
// OBS User Lipsync WebSocket
// =====================
let lipsyncSocket: WebSocket | null = null;

/**
 * Open a WebSocket session for OBS user-avatar mode.
 * Subscribes to ``user_lipsync`` events from Python MicAnalyzer and feeds
 * them into the external lipsync override in audio.ts so visual.ts can
 * drive mouth animation without a browser mic.
 */
export function startLipsyncWebSocket(): void {
  const port = state.settings.app?.port || DEFAULT_PORT;
  const wsUrl = buildWsUrl(port);

  if (lipsyncSocket && (lipsyncSocket.readyState === WebSocket.OPEN || lipsyncSocket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  lipsyncSocket = new WebSocket(wsUrl);

  lipsyncSocket.onopen = () => {
    logStatus('OBS Lipsync Connected');
    const sessionId = `lipsync-${Math.random().toString(36).slice(2, 9)}`;
    lipsyncSocket?.send(JSON.stringify({ type: 'start', session_id: sessionId }));
  };

  lipsyncSocket.onmessage = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data as string);
      if (data.type === 'user_lipsync') {
        const vowel = (data.vowel as Vowel) || null;
        const amplitude = typeof data.amplitude === 'number' ? data.amplitude : 0;
        const speaking = typeof data.speaking === 'boolean' ? data.speaking : false;
        setExternalLipsync(vowel, amplitude, speaking);
      }
    } catch { /* skip malformed */ }
  };

  lipsyncSocket.onclose = () => {
    clearExternalLipsync(); // stop mouth animation while disconnected
    logStatus('OBS Lipsync Disconnected');
    setTimeout(startLipsyncWebSocket, 3000);
  };

  lipsyncSocket.onerror = () => {
    logStatus('OBS Lipsync Error');
  };
}

export async function setupMicStreaming(source: MediaStreamAudioSourceNode): Promise<void> {
  const audioContext = getContext();
  if (!audioContext) return;

  const gen = ++micSetupGen;

  // 1. Clean up previous streaming nodes synchronously, before any await.
  //    This ensures the old worklet's onmessage is nulled out right away.
  if (currentWorkletNode) {
    currentWorkletNode.port.onmessage = null;
    try {
      currentWorkletNode.disconnect();
    } catch (e) { /* ignore */ }
    currentWorkletNode = null;
  }
  if (currentMicSource) {
    try {
      currentMicSource.disconnect();
    } catch (e) { /* ignore */ }
    currentMicSource = null;
  }

  // 2. Initialize the worklet (Vite resolves the URL via ?url import).
  //    Pass the AudioContext's actual sample rate explicitly — the worklet's
  //    own sampleRate global can disagree with audioContext.sampleRate on WKWebView.
  await audioContext.audioWorklet.addModule(processorUrl);

  // If a newer setupMicStreaming call arrived while we were awaiting, abort.
  // Without this guard, two concurrent calls both create a worklet and both
  // start sending PCM to Python → doubled transcription output.
  if (gen !== micSetupGen) {
    return;
  }

  const workletNode = new AudioWorkletNode(audioContext, 'pcm-processor', {
    processorOptions: { actualSampleRate: audioContext.sampleRate },
  });

  currentMicSource = source;
  currentWorkletNode = workletNode;

  source.connect(workletNode);

  // Silent output to keep the audio graph alive
  const silentGain = audioContext.createGain();
  silentGain.gain.value = 0;
  workletNode.connect(silentGain);
  silentGain.connect(audioContext.destination);

  // Receive PCM buffers from the worklet thread
  workletNode.port.onmessage = (e) => {
    if (e.data?.type === 'init') return; // worklet startup acknowledgement, no action needed
    if (state.isAIPlaying) return;
    if (socket && socket.readyState === WebSocket.OPEN) {
      const base64Data = uint8ToBase64(new Uint8Array(e.data));
      socket.send(JSON.stringify({
        type: 'data',
        session_id: 'parcera-session',
        audio_data: base64Data,
      }));
    }
  };
}
