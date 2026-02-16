import './style.css';

const app = document.querySelector('#app');

// Renderer Structure
app.innerHTML = `
  <div class="avatar-container">
    <img id="avatar-base" class="avatar-base" src="/assets/user/base.png" onerror="this.style.display='none'; document.querySelector('#avatar-placeholder').style.display='block';" />
    <div id="avatar-placeholder" style="display:none; width: 200px; height: 300px; background: #334155; border-radius: 100px 100px 20px 20px;"></div>
    <div id="mouth-container" class="avatar-mouth">
       <!-- Mouth SVG will be injected here -->
       <svg id="mouth-svg" width="60" height="40" viewBox="0 0 60 40">
          <path id="mouth-path" d="M 10 20 Q 30 20 50 20" stroke="black" stroke-width="3" fill="none" stroke-linecap="round" />
       </svg>
    </div>
  </div>
`;

const mouthPath = document.querySelector('#mouth-path');
let threshold = 15; // Fallback

async function init() {
  const settings = await window.electronAPI.getSettings();
  if (settings?.avatars?.user) {
    threshold = settings.avatars.user.micThreshold || 15;
    console.log('Using threshold:', threshold);

    // Update assets if defined
    if (settings.avatars.user.assets?.base) {
      document.querySelector('#avatar-base').src = settings.avatars.user.assets.base;
    }
  }
}

init();

// Mic Analysis
let audioContext;
let analyser;
let dataArray;

async function setupMic() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);

    update();
  } catch (err) {
    console.error('Error accessing microphone:', err);
  }
}

function getRMS() {
  analyser.getByteTimeDomainData(dataArray);
  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    const v = (dataArray[i] - 128) / 128; // Normalize to [-1, 1]
    sum += v * v;
  }
  return Math.sqrt(sum / dataArray.length) * 100;
}

function update() {
  const rms = getRMS();

  // Simple Lip Sync logic
  if (rms > threshold) {
    // Open mouth
    mouthPath.setAttribute('d', 'M 10 20 Q 30 45 50 20'); // Simple curve
    mouthPath.setAttribute('fill', 'black');
  } else {
    // Closed mouth
    mouthPath.setAttribute('d', 'M 10 20 Q 30 20 50 20'); // Straight line
    mouthPath.setAttribute('fill', 'none');
  }

  requestAnimationFrame(update);
}

// Start on click (AudioContext requirement)
window.addEventListener('click', () => {
  if (!audioContext) {
    setupMic();
    console.log('Mic setup started');
  }
});

// Auto-start attempt (might be blocked by browser)
setupMic();
