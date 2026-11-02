import test from "node:test";
import assert from "node:assert/strict";

import {
  BALANCE_TARGET,
  applyTonalBalance,
  balanceCorrection,
  measureBalance
} from "../src/lib/dsp/tonal-balance.js";

const sampleRate = 48000;
const bufferOf = (data) => ({ numberOfChannels: 1, length: data.length, sampleRate, getChannelData: () => data });

test("auto balance pulls toward the reference, within its limits", () => {
  assert.deepEqual(
    Object.values(balanceCorrection(BALANCE_TARGET, 1)).map((g) => Math.abs(g) < 1e-9),
    [true, true, true, true],
    "a track already on target is left alone"
  );

  // A dull, boomy track: lows 10 dB over, highs 20 dB under the reference.
  const dull = { ...BALANCE_TARGET, low: BALANCE_TARGET.low + 10, high: BALANCE_TARGET.high - 20 };
  const gains = balanceCorrection(dull, 1);
  assert.equal(gains.low, -1.5);
  assert.equal(gains.high, 2);
  assert.equal(gains.presence, 0);

  const half = balanceCorrection({ ...BALANCE_TARGET, presence: BALANCE_TARGET.presence + 2 }, 0.5);
  assert.ok(Math.abs(half.presence - -0.35) < 1e-9, `half-strength presence ${half.presence}`);
  assert.deepEqual(Object.values(balanceCorrection(dull, 0)).map(Math.abs), [0, 0, 0, 0]);
});

test("auto balance measures the track and moves it the way it says", () => {
  // Mostly 1 kHz with a weak 10 kHz partial: far darker than the reference.
  const data = new Float32Array(sampleRate * 2);
  for (let i = 0; i < data.length; i++) {
    data[i] = 0.3 * Math.sin(2 * Math.PI * 1000 * i / sampleRate) + 0.003 * Math.sin(2 * Math.PI * 10000 * i / sampleRate);
  }
  const before = measureBalance(bufferOf(data));
  const { gains } = applyTonalBalance(bufferOf(data), 1);
  const after = measureBalance(bufferOf(data));
  assert.equal(gains.high, 2);
  // A +2 dB shelf at 8 kHz is worth about +1.3 dB at 10 kHz.
  assert.ok(after.high - before.high > 1, `high moved ${after.high - before.high} dB`);
});

test("auto balance leaves silence and zero amount untouched", () => {
  const silent = new Float32Array(sampleRate);
  assert.equal(applyTonalBalance(bufferOf(silent), 1).gains, null);
  const data = Float32Array.from({ length: sampleRate }, (_, i) => 0.3 * Math.sin(2 * Math.PI * 440 * i / sampleRate));
  const copy = data.slice();
  assert.equal(applyTonalBalance(bufferOf(data), 0).gains, null);
  assert.deepEqual(data, copy);
});
