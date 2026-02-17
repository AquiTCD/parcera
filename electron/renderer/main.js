import './style.css';

console.log('[Parcera] Renderer process starting...');

const params = new URLSearchParams(window.location.search);
const avatarType = params.get('type') || 'user';
console.log('[Parcera] Avatar Type:', avatarType);

// 1. Setup UI
const app = document.querySelector('#app');
// Add a visual confirmation that the window is active/inactive
app.innerHTML = `
  <div class="avatar-container" id="interaction-layer">
    <img id="avatar-base" class="avatar-base" src="/assets/${avatarType}/base.png" />
    <div id="mouth-container" class="avatar-mouth">
       <svg id="mouth-svg" width="60" height="40" viewBox="0 0 60 40">
          <path id="mouth-path" d="M 10 20 Q 30 20 50 20" stroke="black" stroke-width="3" fill="none" stroke-linecap="round" />
       </svg>
    </div>
    <div id="status-debug" style="position:fixed; bottom:10px; left:10px; color:white; background:rgba(0,0,0,0.75); padding: 2px 5px; border-radius: 4px; font-size:10px; pointer-events:none; z-index:100; font-family: monospace;">
      Click anywhere to start
    </div>
  </div>
`;

const mouthPath = document.querySelector('#mouth-path');
const statusDebug = document.querySelector('#status-debug');
let threshold = 15;
let settings = {};

// 2. Audio Infrastructure
let audioContext;
let analyser;
let dataArray;
let socket;
let isAIPlaying = false;

function logStatus(msg) {
  console.log(`[Parcera] ${msg}`);
  if (statusDebug) statusDebug.innerText = msg;
}

function initAudioContext() {
  if (audioContext) return;
  try {
    // CRITICAL: We MUST use 16000Hz for AI Window STT to match Whisper server
    const options = (avatarType === 'ai') ? { sampleRate: 16000 } : {};
    audioContext = new (window.AudioContext || window.webkitAudioContext)(options);

    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    // We don't connect analyser to destination by default to avoid hearing mic input

    dataArray = new Uint8Array(analyser.frequencyBinCount);
    logStatus(`Audio System: ${audioContext.sampleRate}Hz`);
  } catch (e) {
    console.error('AudioContext error:', e);
    logStatus('Audio Init Failed');
  }
}

function getRMS() {
  if (!analyser) return 0;
  analyser.getByteTimeDomainData(dataArray);
  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    const v = (dataArray[i] - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / dataArray.length) * 100;
}

function updateMouth() {
  const rms = getRMS();
  if (rms > threshold) {
    mouthPath.setAttribute('d', 'M 10 20 Q 30 45 50 20');
    mouthPath.setAttribute('fill', 'black');
  } else {
    mouthPath.setAttribute('d', 'M 10 20 Q 30 20 50 20');
    mouthPath.setAttribute('fill', 'none');
  }
  requestAnimationFrame(updateMouth);
}

// 3. Microphone Logic
async function startMic() {
  initAudioContext();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    const micSource = audioContext.createMediaStreamSource(stream);

    if (avatarType === 'user') {
      // User Window: Mic feeds analyser for lip-sync
      micSource.connect(analyser);
      logStatus('User Mic Active');
    } else {
      // AI Window: Mic ONLY feeds WebSocket for STT
      // We explicitly DON'T connect to analyser here so AI doesn't move when user speaks
      setupMicStreaming(micSource);
      logStatus('AI System Listening...');
    }
    updateMouth();
  } catch (err) {
    console.error('Mic Access Denied:', err);
    logStatus('Mic Error: ' + err.message);
  }
}

function setupMicStreaming(source) {
  // ScriptProcessor for robustness (matching sample code)
  const processor = audioContext.createScriptProcessor(4096, 1, 1);
  const silentGain = audioContext.createGain();
  silentGain.gain.value = 0;

  source.connect(processor);
  processor.connect(silentGain);
  silentGain.connect(audioContext.destination);

  processor.onaudioprocess = (e) => {
    // CRITICAL: Stop sending audio data while AI is playing to prevent loopback
    if (isAIPlaying) return;

    if (socket && socket.readyState === WebSocket.OPEN) {
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmData = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        // Safe conversion to Int16
        const s = Math.max(-1, Math.min(1, inputData[i]));
        pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }

      const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
      socket.send(JSON.stringify({
        type: 'data',
        session_id: 'parcera-session',
        audio_data: base64Data
      }));
    }
  };
}

// 4. WebSocket Logic
function startWebSocket() {
  if (avatarType !== 'ai') return;
  const wsUrl = settings.avatars?.ai?.wsUrl || 'ws://localhost:8080/ws';
  logStatus('Connecting to AI Server...');
  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    logStatus('AI Server Online');
    socket.send(JSON.stringify({
      type: 'start',
      session_id: 'parcera-session'
    }));
  };

  socket.onmessage = async (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'start' || data.type === 'thinking') {
      const msg = data.type === 'thinking' ? `Thinking about: ${data.text}` : 'AI responding...';
      logStatus(msg);
      isAIPlaying = true; // Set early to stop mic input immediately
    } else if (data.type === 'chunk' && data.audio_data) {
      playAIResponse(data.audio_data);
    } else if (data.type === 'final') {
      console.log('AI Final Sentence:', data.text);
    } else if (data.type === 'stop') {
      isAIPlaying = false;
      logStatus('AI Response Interrupted');
    } else if (data.type === 'canceled') {
      // Ignore canceled message if we are already playing/thinking,
      // as it usually means a background noise or busy-ignored input was canceled.
      if (!isAIPlaying) {
        logStatus('AI Server Online');
      }
    }
  };

  socket.onclose = () => {
    logStatus('AI Connection Lost');
    setTimeout(startWebSocket, 3000);
  };
}

async function playAIResponse(base64) {
  try {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const audioData = await audioContext.decodeAudioData(bytes.buffer);
    const source = audioContext.createBufferSource();
    source.buffer = audioData;

    // AI Window: AI voice feeds analyser (lip-sync) AND speakers
    source.connect(analyser);
    analyser.connect(audioContext.destination);

    isAIPlaying = true;
    source.start();

    source.onended = () => {
      isAIPlaying = false;
      // Disconnect to stop lip-sync when audio ends
      analyser.disconnect(audioContext.destination);
    };
  } catch (err) {
    console.error('AI Audio Playback Error:', err);
    isAIPlaying = false;
  }
}

// 5. App Entry
// Use multiple event types to ensure it captures the first interaction
const triggerInit = async () => {
  logStatus('Initializing...');
  initAudioContext();
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }
  await startMic();
  if (avatarType === 'ai') {
    startWebSocket();
  }
  // Remove listeners after first success
  window.removeEventListener('click', triggerInit);
  window.removeEventListener('mousedown', triggerInit);
};

window.addEventListener('click', triggerInit);
window.addEventListener('mousedown', triggerInit);

// Background settings load
(async () => {
  try {
    settings = await window.electronAPI.getSettings();
    const config = settings.avatars?.[avatarType] || {};
    threshold = config.micThreshold || 15;
    if (config.assets?.base) {
      document.querySelector('#avatar-base').src = config.assets.base;
    }
    logStatus('Syncing Settings...');
  } catch (e) {
    console.warn('Config not found, using default threshold');
  }
})();
