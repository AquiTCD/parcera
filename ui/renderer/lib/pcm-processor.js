/**
 * PCM Processor — runs in AudioWorklet thread (off main thread).
 *
 * Buffers 4096 Float32 samples at TARGET_RATE (16000 Hz), converts to
 * Int16 PCM, and posts the result back to the main thread.
 *
 * WKWebView / Safari may ignore AudioContext({ sampleRate: 16000 }) and run
 * at hardware rate (44100 or 48000 Hz). The actual rate is passed explicitly
 * via processorOptions.actualSampleRate from the main thread (where
 * audioContext.sampleRate is reliable), because the AudioWorklet sampleRate
 * global has been observed to disagree with AudioContext.sampleRate on
 * WKWebView. Without downsampling, Python STT receives 2-3x too many samples
 * and transcribes each phoneme as 2-3x longer (doubled/stuttered output).
 */
const TARGET_RATE = 16000;
const OUTPUT_BUFFER_SIZE = 4096; // samples at TARGET_RATE per chunk

class PCMProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    // Prefer the rate passed explicitly from main thread (audioContext.sampleRate
    // is trustworthy there). Fall back to the worklet global as a safety net.
    const actualRate = options?.processorOptions?.actualSampleRate ?? sampleRate;
    this.ratio = actualRate / TARGET_RATE; // e.g. 3.0 for 48000→16000

    this.buffer = new Float32Array(OUTPUT_BUFFER_SIZE);
    this.writeIndex = 0;
    this.readPos = 0;
    this.prevSample = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channelData = input[0];
    const len = channelData.length;

    if (this.ratio === 1) {
      // Fast path: context already at 16000 Hz, no resampling needed.
      for (let i = 0; i < len; i++) {
        this.buffer[this.writeIndex++] = channelData[i];
        if (this.writeIndex >= OUTPUT_BUFFER_SIZE) this._flush();
      }
    } else {
      // Downsample via linear interpolation.
      // readPos is the fractional position in channelData; step by ratio each
      // output sample, keeping fractional remainder across process() calls.
      while (true) {
        if (this.readPos >= len) {
          this.readPos -= len;
          this.prevSample = channelData[len - 1];
          break;
        }
        const i0 = Math.floor(this.readPos);
        const frac = this.readPos - i0;
        const s0 = i0 === 0 ? this.prevSample : channelData[i0 - 1];
        const s1 = channelData[i0];
        this.buffer[this.writeIndex++] = s0 + frac * (s1 - s0);
        if (this.writeIndex >= OUTPUT_BUFFER_SIZE) this._flush();
        this.readPos += this.ratio;
      }
    }

    return true;
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
