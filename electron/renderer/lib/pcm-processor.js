/**
 * PCM Processor — runs in AudioWorklet thread (off main thread).
 *
 * Buffers 4096 Float32 samples at the TARGET rate (16000 Hz), converts to
 * Int16 PCM, and posts the result back to the main thread.
 *
 * WKWebView / Safari may ignore the AudioContext({ sampleRate: 16000 })
 * hint and run at hardware rate (44100 or 48000 Hz). When that happens this
 * processor detects the mismatch via the AudioWorklet `sampleRate` global
 * and decimates the input stream down to 16000 Hz using linear interpolation.
 * Without this, Python STT receives 3x too many samples and transcribes each
 * phoneme as 2-3x longer than it really is, causing doubled/stuttered output.
 */
const TARGET_RATE = 16000;
const OUTPUT_BUFFER_SIZE = 4096; // samples at TARGET_RATE per chunk

class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // sampleRate is an AudioWorklet global — reflects the actual context rate.
    this.ratio = sampleRate / TARGET_RATE; // e.g. 3.0 for 48000→16000
    this.buffer = new Float32Array(OUTPUT_BUFFER_SIZE);
    this.writeIndex = 0;
    // Fractional read position in the input stream (for linear interp).
    this.readPos = 0;
    // Previous sample for linear interpolation across process() calls.
    this.prevSample = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channelData = input[0]; // Float32 at actual AudioContext rate
    const len = channelData.length;

    if (this.ratio === 1) {
      // Fast path: no resampling needed (context already at 16000 Hz).
      for (let i = 0; i < len; i++) {
        this.buffer[this.writeIndex++] = channelData[i];
        if (this.writeIndex >= OUTPUT_BUFFER_SIZE) this._flush();
      }
    } else {
      // Downsample with linear interpolation.
      // readPos is the fractional position in channelData (0..len).
      // We step by this.ratio output samples per input sample equivalently,
      // but it's easier to think of it as: for each output sample we need,
      // advance readPos by ratio in the input domain.
      while (true) {
        if (this.readPos >= len) {
          // Consumed all input. Keep fractional remainder for next call.
          this.readPos -= len;
          this.prevSample = channelData[len - 1];
          break;
        }

        const i0 = Math.floor(this.readPos);
        const frac = this.readPos - i0;
        const s0 = i0 === 0 ? this.prevSample : channelData[i0 - 1];
        const s1 = channelData[i0];
        const sample = s0 + frac * (s1 - s0);

        this.buffer[this.writeIndex++] = sample;
        if (this.writeIndex >= OUTPUT_BUFFER_SIZE) this._flush();

        this.readPos += this.ratio;
      }
    }

    return true; // keep processor alive
  }

  _flush() {
    const pcmData = new Int16Array(OUTPUT_BUFFER_SIZE);
    for (let j = 0; j < OUTPUT_BUFFER_SIZE; j++) {
      const s = Math.max(-1, Math.min(1, this.buffer[j]));
      pcmData[j] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    this.port.postMessage(pcmData.buffer, [pcmData.buffer]);
    this.writeIndex = 0;
  }
}

registerProcessor('pcm-processor', PCMProcessor);
