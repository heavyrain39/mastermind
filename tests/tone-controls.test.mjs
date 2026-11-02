import test from "node:test";
import assert from "node:assert/strict";

let messages = [];
globalThis.self = { postMessage: (message) => messages.push(message) };
await import("../src/lib/dsp/worker.js");
const { applyMultibandSaturation } = await import("../src/lib/dsp/multiband-saturation.js");

const sampleRate = 48000;
const length = sampleRate;
const tone = (parts) => {
  const signal = new Float32Array(length);
  for (const [freq, amplitude] of parts) {
    for (let i = 0; i < length; i++) signal[i] += amplitude * Math.sin(2 * Math.PI * freq * i / sampleRate);
  }
  return signal;
};
const render = async (signal, settings) => {
  messages = [];
  await self.onmessage({ data: {
    id: 1, type: "RENDER_FULL_CHAIN", data: {
      channels: [signal, signal.slice()], sampleRate, mode: "export",
      settings: {
        presetId: "custom", inputGain: 0, normalizeLoudness: false, truePeakLimit: false,
        truePeakCeiling: -1, stereoWidth: 101, centerBass: false, ...settings
      }
    }
  } });
  const response = messages.find((m) => m.success === true);
  assert.ok(response, JSON.stringify(messages.at(-1)));
  return response.result.channels[0];
};
const levelDb = (data) => {
  let sum = 0;
  for (let i = length / 2; i < length; i++) sum += data[i] ** 2;
  return 10 * Math.log10(sum / (length / 2));
};
const gainDb = async (freq, settings) => {
  const signal = tone([[freq, 0.1]]);
  return levelDb(await render(signal, settings)) - levelDb(signal);
};

test("Air lifts the top end instead of cancelling around its exciter cutoff", async () => {
  // The old parallel exciter moved 10-16 kHz by under 0.2 dB at Air 100 and
  // dipped 6-10 kHz. Measure each tone against 1 kHz, with and without Air.
  const lift = async (freq) =>
    (await gainDb(freq, { airAmount: 100 }) - await gainDb(1000, { airAmount: 100 })) -
    (await gainDb(freq, { airAmount: 0 }) - await gainDb(1000, { airAmount: 0 }));
  assert.ok(await lift(13000) > 2.5, "13 kHz");
  assert.ok(await lift(6000) > 0, "6 kHz");
});

test("Warmth fills the lows and eases the highs", async () => {
  const shift = async (freq) =>
    (await gainDb(freq, { warmthAmount: 100 }) - await gainDb(1000, { warmthAmount: 100 })) -
    (await gainDb(freq, { warmthAmount: 0 }) - await gainDb(1000, { warmthAmount: 0 }));
  assert.ok(await shift(80) > 1, "80 Hz");
  assert.ok(await shift(13000) < -1, "13 kHz");
});

test("multiband saturation leaves the input's phase alone", () => {
  // Summing the split bands rotated phase and re-grew clipped peaks (a loud
  // mp3 master went from 1.12 to 1.66 peak with no saturation at all).
  const signal = new Float32Array(length);
  for (let i = 0; i < length; i++) signal[i] = Math.max(-0.8, Math.min(0.8, 1.6 * Math.sin(2 * Math.PI * 60 * i / sampleRate)));
  const input = new AudioBuffer({ numberOfChannels: 1, length, sampleRate });
  input.copyToChannel(signal, 0);
  const band = { drive: 0.4, bias: 0.1, mix: 0, gain: 0 };
  const output = applyMultibandSaturation(input, { low: band, mid: band, high: band }).getChannelData(0);
  let error = 0;
  for (let i = 0; i < length; i++) error = Math.max(error, Math.abs(output[i] - signal[i]));
  assert.ok(error < 1e-6, `max deviation ${error}`);
});

test("glue compression is not driven by the bass", async () => {
  // A loud 50 Hz line under a quiet 1 kHz tone used to pull the whole mix down.
  const signal = tone([[50, 0.5], [1000, 0.05]]);
  const output = await render(signal, { glueCompressionAmount: 100 });
  const at1k = (data) => {
    let re = 0, im = 0;
    for (let i = length / 2; i < length; i++) {
      re += data[i] * Math.cos(2 * Math.PI * 1000 * i / sampleRate);
      im += data[i] * Math.sin(2 * Math.PI * 1000 * i / sampleRate);
    }
    return 10 * Math.log10(re * re + im * im);
  };
  const change = at1k(output) - at1k(signal);
  assert.ok(change > -1, `1 kHz ducked by ${change} dB`);
});
