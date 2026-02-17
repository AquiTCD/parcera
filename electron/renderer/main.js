import './style.css';

console.log('[Parcera] Renderer process starting...');

const params = new URLSearchParams(window.location.search);
const avatarType = params.get('type') || 'user';
console.log('[Parcera] Avatar Type:', avatarType);

// 1. Setup UI
const app = document.querySelector('#app');
app.innerHTML = `
  <div id="interaction-layer" style="position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:999; cursor:pointer; display:flex; justify-content:center; align-items:center;">
    <div id="click-prompt" style="color:white; background:rgba(0,0,0,0.5); padding:20px; border-radius:10px; font-family:sans-serif;">
      Click anywhere to start Avatar
    </div>
  </div>
  <div class="avatar-container">
    <img id="avatar-image" class="avatar-main" src="" />
    <div id="status-debug" style="position:fixed; bottom:4px; left:4px; color:white; background:rgba(0,0,0,0.75); padding: 2px 5px; border-radius: 4px; font-size:9px; pointer-events:none; z-index:100; font-family: monospace; white-space: pre;">
      Initializing...
    </div>
  </div>
`;

const avatarImage = document.querySelector('#avatar-image');
const statusDebug = document.querySelector('#status-debug');
const interactionLayer = document.querySelector('#interaction-layer');

let threshold = 15;
let settings = {};

// 2. Audio Infrastructure
let audioContext;
let analyser;
let socket;
let isAIPlaying = false;

// Using Float32 for higher precision analysis matching the sample
const fData = new Float32Array(256); // Half of fftSize 512
const tData = new Float32Array(512);

let persistentStatus = 'Waiting for interaction...';
function logStatus(msg) {
  console.log(`[Parcera] ${msg}`);
  persistentStatus = msg;
}

function initAudioContext() {
  if (audioContext) return;
  try {
    const options = (avatarType === 'ai') ? { sampleRate: 16000 } : {};
    audioContext = new (window.AudioContext || window.webkitAudioContext)(options);

    analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.2;
    logStatus(`Audio System: ${audioContext.sampleRate}Hz`);
  } catch (e) {
    console.error('AudioContext error:', e);
    logStatus('Audio Init Failed');
  }
}

function getRMS() {
  if (!analyser) return 0;
  analyser.getFloatTimeDomainData(tData);
  let sum = 0;
  for (let i = 0; i < tData.length; i++) {
    sum += tData[i] * tData[i];
  }
  let rms = Math.sqrt(sum / tData.length) * 100;
  // AI audio is often cleaner/quieter, so we boost it for lip-sync
  if (avatarType === 'ai' && isAIPlaying) rms *= 1.5;
  return rms;
}

function getVowel() {
  if (!analyser) return null;
  analyser.getFloatFrequencyData(fData); // Returns dB values

  const nyquist = audioContext.sampleRate / 2;
  let weightedFreqSum = 0;
  let totalAmplitude = 0;

  for (let i = 0; i < fData.length; i++) {
    // Convert dB to linear amplitude
    const amplitude = Math.pow(10, fData[i] / 20);
    const freq = (i / fData.length) * nyquist;

    // Ignore low-end rumble below 200Hz
    if (freq > 200) {
      weightedFreqSum += amplitude * freq;
      totalAmplitude += amplitude;
    }
  }

  if (totalAmplitude < 0.001) return null; // Extremely quiet

  const centroid = weightedFreqSum / totalAmplitude;
  const centroid01 = Math.min(1, centroid / nyquist);

  // Mapping Spectral Centroid (0.0 - 1.0) to Japanese Vowels
  // Optimized for 16kHz (AI) and 44.1/48kHz (User)
  if (centroid01 < 0.04) return 'u';
  if (centroid01 < 0.10) return 'o';
  if (centroid01 < 0.20) return 'a';
  if (centroid01 < 0.35) return 'e';
  return 'i';
}

// 3. Animation Logic
let blinkTimer = Date.now() + 2000;
let isBlinking = false;
let currentMouthFile = 'base.png';
let mouthHoldTimer = 0;

function updateVisuals() {
  const rms = getRMS();
  const vowel = rms > threshold ? (getVowel() || '?') : '-';

  // Debug Display Management
  if (statusDebug) {
    const showDebug = settings.avatars?.show_debug !== false;
    statusDebug.style.display = showDebug ? 'block' : 'none';
    const debugInfo = showDebug ? `\nRMS: ${rms.toFixed(1)} | Vowel: ${vowel}` : '';
    statusDebug.innerText = persistentStatus + debugInfo;
  }

  let targetFile = 'base.png';
  const now = Date.now();

  // Blinking Logic with configurable intervals
  if (now > blinkTimer) {
    if (!isBlinking) {
      isBlinking = true;
      blinkTimer = now + 150; // Eyes closed for 150ms
    } else {
      isBlinking = false;
      const min = settings.avatars?.blink_interval_min || 5000;
      const max = settings.avatars?.blink_interval_max || 15000;
      blinkTimer = now + min + Math.random() * (max - min);
    }
  }

  if (isBlinking) {
    targetFile = 'closed.png';
  } else {
    // Mouth Logic with "Hold" to smooth out fast animations
    const holdTime = settings.avatars?.mouth_hold_time || 120;

    if (now > mouthHoldTimer) {
      let nextMouth = 'base.png';
      if (rms > threshold && vowel && vowel !== '?') {
        nextMouth = `${vowel}.png`;
      }

      if (nextMouth !== currentMouthFile) {
        currentMouthFile = nextMouth;
        mouthHoldTimer = now + holdTime;
      }
    }
    targetFile = currentMouthFile;
  }

  const assetsDir = settings.avatars?.[avatarType]?.assets_dir || `/assets/${avatarType}`;
  const targetPath = `${assetsDir}/${targetFile}`;

  if (avatarImage.src !== window.location.origin + targetPath) {
    avatarImage.src = targetPath;
  }

  requestAnimationFrame(updateVisuals);
}

// 4. Microphone Logic
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
      micSource.connect(analyser);
      logStatus('User Mic Active');
    } else {
      setupMicStreaming(micSource);
      logStatus('AI System Listening...');
    }
  } catch (err) {
    console.error('Mic Access Denied:', err);
    logStatus('Mic Error: ' + err.message);
  }
}

function setupMicStreaming(source) {
  const processor = audioContext.createScriptProcessor(4096, 1, 1);
  const silentGain = audioContext.createGain();
  silentGain.gain.value = 0;

  source.connect(processor);
  processor.connect(silentGain);
  silentGain.connect(audioContext.destination);

  processor.onaudioprocess = (e) => {
    if (isAIPlaying) return;
    if (socket && socket.readyState === WebSocket.OPEN) {
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmData = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
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

// 5. WebSocket Logic
function startWebSocket() {
  if (avatarType !== 'ai') return;
  const wsUrl = settings.avatars?.ai?.wsUrl || 'ws://localhost:8080/ws';
  logStatus('Connecting to AI Server...');
  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    logStatus('AI Server Online');
    socket.send(JSON.stringify({ type: 'start', session_id: 'parcera-session' }));
  };

  socket.onmessage = async (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'start' || data.type === 'thinking') {
      isAIPlaying = true;
      logStatus(data.type === 'thinking' ? `Thinking: ${data.text}` : 'AI Responding...');
    } else if (data.type === 'chunk' && data.audio_data) {
      playAIResponse(data.audio_data);
    } else if (data.type === 'stop') {
      isAIPlaying = false;
      logStatus('AI Stopped');
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
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

    const audioData = await audioContext.decodeAudioData(bytes.buffer);
    const source = audioContext.createBufferSource();
    source.buffer = audioData;

    // AI Window: Wire AI voice through analyser for lip-sync
    source.connect(analyser);
    analyser.connect(audioContext.destination);

    isAIPlaying = true;
    source.start();
    console.log('[Parcera] AI Speaking... AudioBuffer Size:', audioData.length);

    source.onended = () => {
      isAIPlaying = false;
      // Do not disconnect destination yet, keep it connected for future chunks
      console.log('[Parcera] AI Chunk Finished');
    };
  } catch (err) {
    console.error('AI Audio Error:', err);
    isAIPlaying = false;
  }
}

// 6. App Entry
let isInitialized = false;

const triggerInit = async (e) => {
  if (isInitialized) return;
  e.stopPropagation();

  console.log('[Parcera] Interaction triggered');
  isInitialized = true;
  interactionLayer.style.display = 'none'; // Completely hide to restore body drag

  logStatus('Initializing Audio...');
  initAudioContext();
  if (audioContext.state === 'suspended') await audioContext.resume();

  await startMic();
  if (avatarType === 'ai') startWebSocket();

  logStatus('System Live');
};

interactionLayer.addEventListener('click', triggerInit);
window.addEventListener('mousedown', triggerInit); // Double guard

// Start visuals immediately (Blinking starts here!)
updateVisuals();

(async () => {
  try {
    settings = await window.electronAPI.getSettings();
    const config = settings.avatars?.[avatarType] || {};
    threshold = config.micThreshold || 15;

    // Set Breathe Animation from settings
    const bScale = settings.avatars?.breathe_scale || 1.005;
    const bAmp = settings.avatars?.breathe_amplitude || 2;
    const bDur = settings.avatars?.breathe_duration || 5000;

    document.documentElement.style.setProperty('--breathe-scale', bScale);
    document.documentElement.style.setProperty('--breathe-amplitude', `${bAmp}px`);
    document.documentElement.style.setProperty('--breathe-duration', `${bDur}ms`);

    // Set Initial Image
    const assetsDir = config.assets_dir || `/assets/${avatarType}`;
    avatarImage.src = `${assetsDir}/base.png`;

    // Explicit Resize Trigger for initial load
    if (avatarImage.complete) {
      console.log(`[Parcera] Initial Resize Trigger: ${avatarImage.naturalWidth}x${avatarImage.naturalHeight}`);
      window.electronAPI.resizeWindow(avatarImage.naturalWidth, avatarImage.naturalHeight);
    }
    avatarImage.onerror = () => {
      const src = avatarImage.src;
      if (src.endsWith('/e.png')) {
        avatarImage.src = src.replace('/e.png', '/a.png');
      } else if (src.endsWith('/o.png')) {
        avatarImage.src = src.replace('/o.png', '/u.png');
      }
    };

    logStatus('Settings Loaded');
  } catch (e) {
    console.error('Settings error:', e);
    const assetsDir = `/assets/${avatarType}`;
    avatarImage.src = `${assetsDir}/base.png`;
    logStatus('Using Defaults');
  }
})();
