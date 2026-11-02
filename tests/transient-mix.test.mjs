import test from "node:test";
import assert from "node:assert/strict";

test("transient enhancement blend leaves no notch at its crossovers", async () => {
  let messages = [];
  globalThis.self = { postMessage: (message) => messages.push(message) };
  await import("../src/lib/dsp/worker.js");

  const sampleRate = 48000;
  const length = sampleRate;
  const render = async (freq, autoLevelAmount) => {
    const signal = new Float32Array(length);
    for (let i = 0; i < length; i++) signal[i] = Math.sin(2 * Math.PI * freq * i / sampleRate) * 0.1;
    messages = [];
    await self.onmessage({ data: {
      id: 1, type: "RENDER_FULL_CHAIN", data: {
        channels: [signal, signal.slice()], sampleRate, mode: "export",
        settings: {
          presetId: "custom", inputGain: 0, normalizeLoudness: false, truePeakLimit: false,
          truePeakCeiling: -1, stereoWidth: 100, centerBass: false, autoLevelAmount
        }
      }
    } });
    const response = messages.find((m) => m.success === true);
    assert.ok(response, JSON.stringify(messages.at(-1)));
    const output = response.result.channels[0];
    let a = 0, b = 0;
    for (let i = length / 2; i < length; i++) { a += signal[i] ** 2; b += output[i] ** 2; }
    return 10 * Math.log10(b / a);
  };

  // Auto level 54 skips the transient stage and 100 runs it at its widest blend,
  // so the difference isolates that stage. The old dry/wet blend cancelled
  // about 6 dB at the 200 Hz and 4 kHz crossovers.
  const stageGain = {};
  for (const freq of [200, 1000, 4000]) stageGain[freq] = (await render(freq, 100)) - (await render(freq, 54));
  for (const freq of [200, 4000]) {
    assert.ok(Math.abs(stageGain[freq] - stageGain[1000]) < 1, `${freq} Hz: ${JSON.stringify(stageGain)}`);
  }
});
