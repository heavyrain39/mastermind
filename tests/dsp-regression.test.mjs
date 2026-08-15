import test from "node:test";
import assert from "node:assert/strict";

import { processWithFFT } from "../src/lib/dsp/fft.js";
import { applySoftKneeCurve } from "../src/lib/dsp/limiter.js";
import { measureLUFS } from "../src/lib/dsp/lufs.js";

test("FFT identity processing preserves level and boundaries", () => {
  for (const length of [1, 511, 2048, 48000, 48511]) {
    const input = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      input[i] = Math.sin(i * 0.017) * 0.73 + Math.cos(i * 0.003) * 0.19;
    }

    const output = processWithFFT(input, 2048, 512, () => {}, 48000);
    let maxError = 0;
    for (let i = 0; i < input.length; i++) {
      maxError = Math.max(maxError, Math.abs(input[i] - output[i]));
    }

    assert.ok(maxError < 1e-5, `length ${length} max error was ${maxError}`);
  }
});

test("soft-knee curve is continuous, monotonic, non-boosting and ceiling-safe", () => {
  const ceiling = Math.pow(10, -1 / 20);
  let previous = 0;

  for (let i = 0; i <= 20000; i++) {
    const input = ceiling * 2 * (i / 20000);
    const output = applySoftKneeCurve(input, ceiling, 3);

    assert.ok(Number.isFinite(output));
    assert.ok(output + 1e-12 >= previous, `curve fell at input ${input}`);
    assert.ok(output <= input + 1e-12, `curve boosted input ${input}`);
    assert.ok(output <= ceiling + 1e-12, `curve exceeded ceiling at input ${input}`);
    assert.equal(applySoftKneeCurve(-input, ceiling, 3), -output);
    previous = output;
  }

  const left = applySoftKneeCurve(ceiling * 0.9, ceiling, 3);
  const right = applySoftKneeCurve(ceiling * 0.900001, ceiling, 3);
  assert.ok(Math.abs(right - left) < ceiling * 0.00001);
});

test("LUFS measurement sums channel energy instead of averaging it", () => {
  const sampleRate = 48000;
  const length = sampleRate;
  const signal = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    signal[i] = Math.sin(2 * Math.PI * 1000 * i / sampleRate) * 0.1;
  }

  const createBuffer = (channels) => ({
    sampleRate,
    numberOfChannels: channels.length,
    length,
    duration: length / sampleRate,
    getChannelData: (channel) => channels[channel]
  });

  const monoLufs = measureLUFS(createBuffer([signal]));
  const stereoLufs = measureLUFS(createBuffer([signal, signal]));
  assert.ok(Math.abs((stereoLufs - monoLufs) - 10 * Math.log10(2)) < 1e-6);
});
