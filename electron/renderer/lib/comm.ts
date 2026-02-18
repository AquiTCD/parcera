/**
 * Parcera: Communication Manager
 *
 * WebSocket connection to the Python AI server, microphone streaming
 * (PCM → Base64), and sequential audio playback queue.
 */
import { state, logStatus } from './state';
import type { ServerMessage } from './state';
import { getContext, getAnalyser } from './audio';

// --- Module State ---
let socket: WebSocket | null = null;
let playbackRouteReady = false;

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

async function playNextChunk(): Promise<void> {
  if (audioQueue.length === 0) {
    isProcessingQueue = false;
    currentSource = null;
    state.isAIPlaying = false;
    logStatus('AI Stopped');
    return;
  }

  isProcessingQueue = true;
  const base64 = audioQueue.shift()!;
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

    source.connect(analyser);
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
    playNextChunk(); // skip bad chunk
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

export function startWebSocket(): void {
  if (state.avatarType !== 'ai') return;

  initPlaybackRoute(); // wire analyser→destination once

  // Derive URL from electron.port — no need for a separate wsUrl setting
  const port = state.settings.electron?.port || 8080;
  const wsUrl = `ws://localhost:${port}/ws`;
  logStatus('Connecting to AI Server...');
  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
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
    logStatus('AI Connection Lost');
    setTimeout(startWebSocket, 3000);
  };
}

// =====================
// Mic Streaming
// =====================
const BASE64_CHUNK_SIZE = 8192;

export function setupMicStreaming(source: MediaStreamAudioSourceNode): void {
  const audioContext = getContext();
  if (!audioContext) return;

  const processor = audioContext.createScriptProcessor(4096, 1, 1);
  const silentGain = audioContext.createGain();
  silentGain.gain.value = 0;

  source.connect(processor);
  processor.connect(silentGain);
  silentGain.connect(audioContext.destination);

  processor.onaudioprocess = (e: AudioProcessingEvent) => {
    if (state.isAIPlaying) return;
    if (socket && socket.readyState === WebSocket.OPEN) {
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmData = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      // Encode PCM to Base64 without stack overflow (chunked loop)
      const uint8 = new Uint8Array(pcmData.buffer);
      let binary = '';
      for (let offset = 0; offset < uint8.length; offset += BASE64_CHUNK_SIZE) {
        binary += String.fromCharCode.apply(null, Array.from(uint8.subarray(offset, offset + BASE64_CHUNK_SIZE)));
      }
      const base64Data = btoa(binary);
      socket.send(JSON.stringify({
        type: 'data',
        session_id: 'parcera-session',
        audio_data: base64Data
      }));
    }
  };
}
