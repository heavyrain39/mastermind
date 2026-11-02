/**
 * Tonal Balance Module
 * Measures a track's long-term spectral balance and nudges it part of the way
 * toward a reference balance, so dull mixes open up, harsh ones settle and
 * boomy or thin low ends move toward the middle. Corrections are capped so a
 * deliberately dark or bright arrangement keeps its character.
 */

import { FFTProcessor } from './fft.js';
import {
  applyBiquadFilterInto,
  calcHighShelfCoeffs,
  calcLowShelfCoeffs,
  calcPeakingCoeffs
} from './utils.js';

const FFT_SIZE = 4096;

// Long-term level of each region relative to 0.8-3 kHz, in dB.
export const BALANCE_REGIONS = {
  low: [20, 250],
  lowMid: [250, 800],
  presence: [3000, 6000],
  high: [6000, 16000]
};
const REFERENCE_REGION = [800, 3000];

/**
 * Reference balance: the median of 20 full mixes (pop, rock, electronic,
 * piano, ambient; -6 to -16 LUFS), with the top end raised 0.5 dB so the
 * result leans slightly open rather than merely average.
 */
export const BALANCE_TARGET = {
  low: 9.9,
  lowMid: 4.9,
  presence: -6.2,
  high: -6.6
};

// Each region's correction filter, and how far it may move at full amount.
const CORRECTIONS = {
  low: { type: 'lowShelf', freq: 150, Q: 0.707, maxDb: 1.5 },
  lowMid: { type: 'peaking', freq: 450, Q: 0.9, maxDb: 1.5 },
  presence: { type: 'peaking', freq: 4200, Q: 0.9, maxDb: 1.5 },
  high: { type: 'highShelf', freq: 8000, Q: 0.707, maxDb: 2 }
};

// Share of the measured deviation corrected at amount = 1.
const CORRECTION_STRENGTH = 0.35;

/**
 * Measure region levels relative to 0.8-3 kHz across the whole track.
 * Frames quieter than -60 dBFS are skipped so silence does not count.
 * @param {AudioBuffer} buffer
 * @returns {Object|null} dB per region, or null for silent input
 */
export function measureBalance(buffer) {
  const processor = new FFTProcessor(FFT_SIZE, FFT_SIZE);
  const power = new Float64Array(FFT_SIZE / 2);
  const block = new Float32Array(FFT_SIZE);
  const gate = FFT_SIZE * 1e-6; // -60 dBFS mean square over a frame
  let frames = 0;

  for (let start = 0; start + FFT_SIZE <= buffer.length; start += FFT_SIZE) {
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      block.set(buffer.getChannelData(ch).subarray(start, start + FFT_SIZE));
      let energy = 0;
      for (let i = 0; i < FFT_SIZE; i++) energy += block[i] * block[i];
      if (energy < gate) continue;

      const spectrum = processor.forward(block);
      for (let bin = 0; bin < FFT_SIZE / 2; bin++) {
        power[bin] += spectrum[bin * 2] ** 2 + spectrum[bin * 2 + 1] ** 2;
      }
      frames++;
    }
  }
  if (frames === 0) return null;

  const binHz = buffer.sampleRate / FFT_SIZE;
  const regionPower = ([lo, hi]) => {
    let sum = 0;
    for (let bin = Math.ceil(lo / binHz); bin < Math.min(FFT_SIZE / 2, hi / binHz); bin++) sum += power[bin];
    return sum;
  };
  const reference = regionPower(REFERENCE_REGION);
  if (!(reference > 0)) return null;

  const balance = {};
  for (const [name, region] of Object.entries(BALANCE_REGIONS)) {
    balance[name] = 10 * Math.log10(Math.max(regionPower(region), 1e-30) / reference);
  }
  return balance;
}

/**
 * Correction gains (dB) that move a measured balance toward the target.
 * @param {Object} balance - From measureBalance
 * @param {number} amount - 0..1
 */
export function balanceCorrection(balance, amount) {
  const gains = {};
  for (const [name, correction] of Object.entries(CORRECTIONS)) {
    const wanted = (BALANCE_TARGET[name] - balance[name]) * CORRECTION_STRENGTH * amount;
    const limit = correction.maxDb * amount;
    gains[name] = Math.max(-limit, Math.min(limit, wanted));
  }
  return gains;
}

/**
 * Apply automatic tonal balance in place.
 * @param {AudioBuffer} buffer
 * @param {number} amount - 0..1
 * @returns {{buffer: AudioBuffer, gains: Object|null}}
 */
export function applyTonalBalance(buffer, amount) {
  const balance = amount > 0 ? measureBalance(buffer) : null;
  if (!balance) return { buffer, gains: null };

  const gains = balanceCorrection(balance, amount);
  const sampleRate = buffer.sampleRate;
  const coeffs = [];
  for (const [name, { type, freq, Q }] of Object.entries(CORRECTIONS)) {
    if (Math.abs(gains[name]) < 0.05 || freq >= sampleRate * 0.45) continue;
    if (type === 'lowShelf') coeffs.push(calcLowShelfCoeffs(sampleRate, freq, gains[name], Q));
    else if (type === 'highShelf') coeffs.push(calcHighShelfCoeffs(sampleRate, freq, gains[name], Q));
    else coeffs.push(calcPeakingCoeffs(sampleRate, freq, gains[name], Q));
  }

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (const c of coeffs) applyBiquadFilterInto(data, data, c);
  }
  return { buffer, gains };
}
