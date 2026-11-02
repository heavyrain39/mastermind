import test from "node:test";
import assert from "node:assert/strict";

class TestAudioBuffer {
  constructor({ numberOfChannels, length, sampleRate }) {
    this.numberOfChannels = numberOfChannels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
  }
  getChannelData(channel) { return this.channels[channel]; }
}
globalThis.AudioBuffer = TestAudioBuffer;
const { HybridDynamicProcessor } = await import("../src/lib/dsp/dynamic-processor.js");

const sampleRate = 48000;
const rmsDb = (data, from, to) => {
  let sum = 0;
  for (let i = from; i < to; i++) sum += data[i] ** 2;
  return 10 * Math.log10(sum / (to - from));
};
const processTone = (amplitudeAt) => {
  const length = sampleRate * 2;
  const input = new TestAudioBuffer({ numberOfChannels: 1, length, sampleRate });
  const data = input.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = amplitudeAt(i) * Math.sin(2 * Math.PI * 4500 * i / sampleRate);
  const processor = HybridDynamicProcessor.createMasteringPreset();
  processor.dryWetMix = 1;
  processor.dynamicEqEnabled = false;
  return { data, output: processor.process(input).getChannelData(0) };
};

test("clarity band levels read as dBFS, so a quiet presence tone passes untouched", () => {
  // -43 dBFS RMS sits below the -32 dB presence threshold and its knee.
  // Unscaled FFT magnitudes read about 50 dB hot and compressed it anyway.
  const { data, output } = processTone(() => 0.01);
  const change = rmsDb(output, sampleRate / 2, sampleRate * 1.5) - rmsDb(data, sampleRate / 2, sampleRate * 1.5);
  assert.ok(Math.abs(change) < 0.1, `quiet tone changed by ${change} dB`);
});

test("clarity band envelopes follow their millisecond attack times", () => {
  // A jump from -43 to -9 dBFS should be fully compressed within ~50 ms
  // (2 ms attack). Envelopes timed per sample but stepped per frame took ~1 s.
  const step = sampleRate;
  const { data, output } = processTone((i) => (i < step ? 0.01 : 0.5));
  const gain = (from, to) => rmsDb(output, from, to) - rmsDb(data, from, to);
  const early = gain(step + 2400, step + 4800);
  const settled = gain(step + 38400, step + 48000);
  assert.ok(settled < -6, `steady compression ${settled} dB`);
  assert.ok(Math.abs(early - settled) < 1, `50-100 ms after the jump ${early} dB vs settled ${settled} dB`);
});
