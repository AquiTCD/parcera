/**
 * PCM Processor — runs in AudioWorklet thread (off main thread).
 *
 * Buffers 4096 Float32 samples (matching the old ScriptProcessor buffer size),
 * converts to Int16 PCM, and posts the result back to the main thread.
 */
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(4096);
    this.writeIndex = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channelData = input[0];
    for (let i = 0; i < channelData.length; i++) {
      this.buffer[this.writeIndex++] = channelData[i];

      if (this.writeIndex >= this.buffer.length) {
        // Buffer full — convert Float32 → Int16 PCM
        const pcmData = new Int16Array(this.buffer.length);
        for (let j = 0; j < this.buffer.length; j++) {
          const s = Math.max(-1, Math.min(1, this.buffer[j]));
          pcmData[j] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        this.port.postMessage(pcmData.buffer, [pcmData.buffer]);
        this.writeIndex = 0;
      }
    }

    return true; // keep processor alive
  }
}

registerProcessor('pcm-processor', PCMProcessor);
