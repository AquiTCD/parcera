/**
 * Parcera: Communication Manager
 *
 * WebSocket connection to the Python AI server, microphone streaming
 * (PCM via AudioWorklet → Base64), and sequential audio playback queue.
 */
import { state, logStatus } from './state';
import type { ServerMessage } from './state';
import { getContext, getAnalyser, connectToAnalyser } from './audio';
import processorUrl from './pcm-processor.js?url';

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
    const res = await fetch(`http://127.0.0.1:${port}/health`);
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

  const port = state.settings.electron?.port || 8080;
  const wsUrl = `ws://127.0.0.1:${port}/ws`;

  // Skip if we are already connected or connecting to the correct URL
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    if (socket.url === wsUrl) {
      console.log('[Parcera] WebSocket already active for:', wsUrl);
      return;
    }
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

    const wsUrl = `ws://127.0.0.1:${port}/ws`;
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
      } else if (data.type === 'stop') {
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
  });
}

// =====================
// Mic Streaming (AudioWorklet — off main thread)
// =====================
// --- Mic Streaming State ---
let currentMicSource: MediaStreamAudioSourceNode | null = null;
let currentWorkletNode: AudioWorkletNode | null = null;

export async function setupMicStreaming(source: MediaStreamAudioSourceNode): Promise<void> {
  const audioContext = getContext();
  if (!audioContext) return;

  // 1. Clean up previous streaming nodes
  if (currentWorkletNode) {
    console.log('[Parcera] Cleaning up previous mic worklet...');
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

  // 2. Initialize the worklet (Vite resolves the URL via ?url import)
  await audioContext.audioWorklet.addModule(processorUrl);
  const workletNode = new AudioWorkletNode(audioContext, 'pcm-processor');

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
