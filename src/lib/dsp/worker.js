/**
 * DSP Web Worker
 * Handles heavy audio processing off the main thread
 *
 * Message format:
 * - Request: { type: string, id: number, data: object }
 * - Response: { id: number, success: boolean, result?: any, error?: string }
 * - Progress: { id: number, type: 'PROGRESS', progress: number, status: string }
 */

// Import DSP modules
import {
  K_WEIGHTING,
  LUFS_CONSTANTS,
  LIMITER_DEFAULTS,
  applyBiquadFilter,
  calcHighShelfCoeffs,
  calcHighPassCoeffs,
  dbToLinear,
  // Full chain DSP functions
  measureLUFS,
  findTruePeak,
  applyGain,
  normalizeToLUFS,
  applyMultibandTransient,
  applyExciterWithOptions,
  applyMultibandSaturation,
  applyDynamicLeveling,
  HybridDynamicProcessor,
  applyFinalFilters,
  applyLookaheadLimiter
} from './index.js';

/**
 * Worker-compatible AudioBuffer replacement
 * Mimics the AudioBuffer interface using plain Float32Arrays
 */
class WorkerAudioBuffer {
  constructor({ numberOfChannels, length, sampleRate }) {
    this.numberOfChannels = numberOfChannels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.duration = length / sampleRate;
    this._channels = [];
    for (let i = 0; i < numberOfChannels; i++) {
      this._channels.push(new Float32Array(length));
    }
  }

  getChannelData(channel) {
    return this._channels[channel];
  }

  copyToChannel(source, channel, startInChannel = 0) {
    const dest = this._channels[channel];
    dest.set(source, startInChannel);
  }

  copyFromChannel(dest, channel, startInChannel = 0) {
    const source = this._channels[channel];
    dest.set(source.subarray(startInChannel, startInChannel + dest.length));
  }
}

// Polyfill AudioBuffer for worker context - DSP functions use this globally
globalThis.AudioBuffer = WorkerAudioBuffer;

/**
 * Send progress update to main thread
 */
function sendProgress(id, progress, status) {
  self.postMessage({ id, type: 'PROGRESS', progress, status });
}

function clamp01(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function normalizeAmount(value) {
  return clamp01((Number(value) || 0) / 100);
}

function mixBuffers(dryBuffer, wetBuffer, wetMix) {
  const mix = clamp01(wetMix);
  if (mix <= 0) {
    return dryBuffer;
  }
  if (mix >= 1) {
    return wetBuffer;
  }

  const output = new AudioBuffer({
    numberOfChannels: dryBuffer.numberOfChannels,
    length: dryBuffer.length,
    sampleRate: dryBuffer.sampleRate
  });

  for (let ch = 0; ch < dryBuffer.numberOfChannels; ch++) {
    const dry = dryBuffer.getChannelData(ch);
    const wet = wetBuffer.getChannelData(ch);
    const out = output.getChannelData(ch);
    for (let i = 0; i < dry.length; i++) {
      out[i] = dry[i] * (1 - mix) + wet[i] * mix;
    }
  }

  return output;
}

function applyOnePoleLowpass(samples, cutoffHz, sampleRate) {
  const output = new Float32Array(samples.length);
  if (samples.length === 0) {
    return output;
  }

  const rc = 1 / (2 * Math.PI * cutoffHz);
  const dt = 1 / sampleRate;
  const alpha = dt / (rc + dt);

  let y = samples[0];
  for (let i = 0; i < samples.length; i++) {
    y += alpha * (samples[i] - y);
    output[i] = y;
  }

  return output;
}

function enhanceStereoDepth(side, sampleRate, amount) {
  const depth = clamp01(amount);
  if (depth <= 0) {
    return side;
  }

  const delayMs = 4 + depth * 8;
  const delaySamples = Math.max(1, Math.floor(sampleRate * delayMs / 1000));
  const delayed = new Float32Array(side.length);

  for (let i = delaySamples; i < side.length; i++) {
    delayed[i] = side[i - delaySamples];
  }

  const highPassed = applyBiquadFilter(
    delayed,
    calcHighPassCoeffs(sampleRate, 220 + depth * 80, 0.707)
  );
  const softened = applyOnePoleLowpass(highPassed, 7000 - depth * 2000, sampleRate);
  const mix = 0.04 + depth * 0.12;
  const output = new Float32Array(side.length);

  for (let i = 0; i < side.length; i++) {
    output[i] = side[i] + softened[i] * mix;
  }

  return output;
}

function applyClarityProcessing(buffer, amount) {
  const clarity = clamp01(amount);
  if (clarity <= 0) {
    return buffer;
  }

  const processor = HybridDynamicProcessor.createMasteringPreset();
  processor.dryWetMix = 1.0;
  processor.dynamicEqSensitivity = 0.08 + clarity * 0.22;
  processor.dynamicEqMaxCut = -(1.5 + clarity * 4.5);

  const wet = processor.process(buffer);
  return mixBuffers(buffer, wet, 0.10 + clarity * 0.28);
}

function applyAirProcessing(buffer, amount) {
  const air = clamp01(amount);
  if (air <= 0) {
    return buffer;
  }

  return applyExciterWithOptions(buffer, {
    hpfFreq: 6500 - air * 1000,
    hpfSlope: 12,
    drive: 0.25 + air * 0.45,
    bias: 0.08 + air * 0.12,
    mix: 1.5 + air * 6.5,
    oversample: true
  });
}

function applyWarmthProcessing(buffer, amount) {
  const warmth = clamp01(amount);
  if (warmth <= 0) {
    return buffer;
  }

  return applyMultibandSaturation(buffer, {
    f1: 200,
    f2: 3800,
    low: {
      drive: 0.08 + warmth * 0.14,
      bias: warmth * 0.04,
      mix: 0.10 + warmth * 0.12,
      gain: 0
    },
    mid: {
      drive: 0.16 + warmth * 0.24,
      bias: 0.04 + warmth * 0.06,
      mix: 0.16 + warmth * 0.18,
      gain: 0
    },
    high: {
      drive: 0.08 + warmth * 0.14,
      bias: warmth * 0.04,
      mix: 0.06 + warmth * 0.10,
      gain: 0
    },
    bypass: {
      thresholdDb: -24,
      kneeDb: 6,
      windowMs: 100,
      lookaheadMs: 5
    }
  });
}

function applyAutoLevelProcessing(buffer, amount, truePeakCeiling) {
  const autoLevel = clamp01(amount);
  if (autoLevel <= 0) {
    return buffer;
  }

  const wet = applyDynamicLeveling(
    buffer,
    {
      windowMs: 160 + autoLevel * 60,
      quietThresholdDB: -40 - autoLevel * 8,
      expansionRatio: 1.02 + autoLevel * 0.18,
      maxGainDB: 0.5 + autoLevel * 1.5,
      minGainDB: -(1.5 + autoLevel * 3.5),
      crestThresholdDB: 14 - autoLevel * 3,
      attackMs: 18 - autoLevel * 8,
      releaseMs: 120 + autoLevel * 80,
      lookaheadMs: 5,
      targetGain: 1.0,
      peakLimit: Math.pow(10, Math.min(-0.3, truePeakCeiling) / 20)
    }
  );

  return mixBuffers(buffer, wet, 0.18 + autoLevel * 0.42);
}

/**
 * Measure LUFS from raw channel data
 * Worker-compatible version that doesn't require AudioBuffer
 */
function measureLUFSFromChannels(channels, sampleRate, fallbackLufs = -14) {
  const numChannels = channels.length;
  const length = channels[0].length;
  const duration = length / sampleRate;

  // Minimum block size required for LUFS measurement
  if (duration < LUFS_CONSTANTS.BLOCK_SIZE_SEC) {
    console.warn(`[Worker LUFS] Audio too short for reliable measurement`);
    return fallbackLufs;
  }

  // Apply K-weighting filters
  const highShelfCoeffs = calcHighShelfCoeffs(
    sampleRate,
    K_WEIGHTING.HIGH_SHELF_FREQ,
    K_WEIGHTING.HIGH_SHELF_GAIN,
    K_WEIGHTING.HIGH_SHELF_Q
  );
  const highPassCoeffs = calcHighPassCoeffs(
    sampleRate,
    K_WEIGHTING.HIGH_PASS_FREQ,
    K_WEIGHTING.HIGH_PASS_Q
  );

  const filteredChannels = channels.map(ch => {
    let filtered = applyBiquadFilter(ch, highShelfCoeffs);
    filtered = applyBiquadFilter(filtered, highPassCoeffs);
    return filtered;
  });

  // Calculate mean square per block with overlap
  const blockSize = Math.floor(sampleRate * LUFS_CONSTANTS.BLOCK_SIZE_SEC);
  const hopSize = Math.floor(sampleRate * LUFS_CONSTANTS.BLOCK_SIZE_SEC * (1 - LUFS_CONSTANTS.BLOCK_OVERLAP));
  const blocks = [];

  for (let start = 0; start + blockSize <= length; start += hopSize) {
    let sumSquares = 0;
    for (let ch = 0; ch < numChannels; ch++) {
      const channelData = filteredChannels[ch];
      for (let i = start; i < start + blockSize; i++) {
        sumSquares += channelData[i] * channelData[i];
      }
    }
    blocks.push(sumSquares / (blockSize * numChannels));
  }

  if (blocks.length === 0) return -Infinity;

  // Absolute threshold gating
  let gatedBlocks = blocks.filter(ms => ms > LUFS_CONSTANTS.ABSOLUTE_GATE_LINEAR);
  if (gatedBlocks.length === 0) return -Infinity;

  // Relative threshold gating
  const ungatedMean = gatedBlocks.reduce((a, b) => a + b, 0) / gatedBlocks.length;
  gatedBlocks = gatedBlocks.filter(ms => ms > ungatedMean * LUFS_CONSTANTS.RELATIVE_GATE_OFFSET);
  if (gatedBlocks.length === 0) return -Infinity;

  // Calculate integrated loudness
  const gatedMean = gatedBlocks.reduce((a, b) => a + b, 0) / gatedBlocks.length;
  return LUFS_CONSTANTS.LOUDNESS_OFFSET + 10 * Math.log10(gatedMean);
}

/**
 * Calculate true peak using 4x oversampled Catmull-Rom interpolation
 */
function calculateTruePeakSample(prevSamples) {
  const y0 = prevSamples[0];
  const y1 = prevSamples[1];
  const y2 = prevSamples[2];
  const y3 = prevSamples[3];

  let peak = Math.abs(y2);

  const a0 = -0.5 * y0 + 1.5 * y1 - 1.5 * y2 + 0.5 * y3;
  const a1 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3;
  const a2 = -0.5 * y0 + 0.5 * y2;
  const a3 = y1;

  for (let i = 1; i <= 3; i++) {
    const t = i * 0.25;
    const t2 = t * t;
    const t3 = t2 * t;
    const interpolated = a0 * t3 + a1 * t2 + a2 * t + a3;
    peak = Math.max(peak, Math.abs(interpolated));
  }

  return peak;
}

/**
 * Find true peak from channel data
 */
function findTruePeakFromChannels(channels) {
  let maxPeak = 0;

  for (let ch = 0; ch < channels.length; ch++) {
    const channelData = channels[ch];
    const prevSamples = [0, 0, 0, 0];

    for (let i = 0; i < channelData.length; i++) {
      prevSamples[0] = prevSamples[1];
      prevSamples[1] = prevSamples[2];
      prevSamples[2] = prevSamples[3];
      prevSamples[3] = channelData[i];

      if (i >= 3) {
        const truePeak = calculateTruePeakSample(prevSamples);
        if (truePeak > maxPeak) {
          maxPeak = truePeak;
        }
      }
    }
  }

  return maxPeak > 0 ? 20 * Math.log10(maxPeak) : -Infinity;
}

/**
 * Apply soft-knee limiting curve
 */
function applySoftKneeCurve(sample, ceiling, kneeDB = 3) {
  const absSample = Math.abs(sample);

  if (absSample <= ceiling * 0.9) {
    return sample;
  }

  const kneeRatio = Math.pow(10, kneeDB / 20);
  const kneeStart = ceiling / kneeRatio;

  if (absSample <= kneeStart) {
    return sample;
  }

  if (absSample <= ceiling) {
    const t = (absSample - kneeStart) / (ceiling - kneeStart);
    const blend = t * t * (3 - 2 * t);
    const output = absSample + (ceiling - absSample) * blend * 0.5;
    return Math.sign(sample) * output;
  }

  // Above ceiling - soft limiting that never exceeds ceiling
  const excess = absSample - ceiling;

  // Compress excess using tanh - output approaches ceiling but never exceeds it
  const normalized = excess / ceiling;
  const compression = 1 - Math.tanh(normalized * 2) * 0.1;

  // Ensure output never exceeds ceiling
  const output = Math.min(ceiling, absSample * compression);

  return Math.sign(sample) * output;
}

/**
 * Apply soft-knee with oversampling
 */
function applySoftKneeOversampled(input, ceiling, kneeDB = 3) {
  const length = input.length;
  const output = new Float32Array(length);
  const prevSamples = [0, 0, 0, 0];

  for (let i = 0; i < length; i++) {
    prevSamples[0] = prevSamples[1];
    prevSamples[1] = prevSamples[2];
    prevSamples[2] = prevSamples[3];
    prevSamples[3] = input[i];

    if (i < 3) {
      output[i] = applySoftKneeCurve(input[i], ceiling, kneeDB);
      continue;
    }

    const y0 = prevSamples[0];
    const y1 = prevSamples[1];
    const y2 = prevSamples[2];
    const y3 = prevSamples[3];

    const a0 = -0.5 * y0 + 1.5 * y1 - 1.5 * y2 + 0.5 * y3;
    const a1 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3;
    const a2 = -0.5 * y0 + 0.5 * y2;
    const a3 = y1;

    let maxInterpolated = Math.abs(y2);

    for (let j = 1; j <= 3; j++) {
      const t = j * 0.25;
      const t2 = t * t;
      const t3 = t2 * t;
      const interpolated = Math.abs(a0 * t3 + a1 * t2 + a2 * t + a3);
      if (interpolated > maxInterpolated) {
        maxInterpolated = interpolated;
      }
    }

    if (maxInterpolated > ceiling) {
      const gainReduction = ceiling / maxInterpolated;
      output[i] = applySoftKneeCurve(input[i] * gainReduction, ceiling, kneeDB);
    } else {
      output[i] = applySoftKneeCurve(input[i], ceiling, kneeDB);
    }
  }

  return output;
}

/**
 * Apply lookahead limiter to channel data
 */
function applyLookaheadLimiterToChannels(
  channels,
  sampleRate,
  id,
  ceilingLinear = LIMITER_DEFAULTS.CEILING_LINEAR,
  lookaheadMs = LIMITER_DEFAULTS.LOOKAHEAD_MS,
  releaseMs = LIMITER_DEFAULTS.RELEASE_MS,
  kneeDB = LIMITER_DEFAULTS.KNEE_DB,
  preserveTransients = LIMITER_DEFAULTS.PRESERVE_TRANSIENTS
) {
  const numChannels = channels.length;
  const length = channels[0].length;

  const lookaheadSamples = Math.floor(sampleRate * lookaheadMs / 1000);
  const releaseCoef = Math.exp(-1 / (releaseMs * sampleRate / 1000));

  sendProgress(id, 0.1, 'Analyzing transients...');

  // Transient detection
  let transientMap = null;
  if (preserveTransients) {
    transientMap = new Float32Array(length);
    const windowMs = 10;
    const windowSamples = Math.floor(sampleRate * windowMs / 1000);

    const rmsEnvelope = new Float32Array(length);
    let rmsSum = 0;

    for (let i = 0; i < length; i++) {
      let sampleSum = 0;
      for (let ch = 0; ch < numChannels; ch++) {
        sampleSum += channels[ch][i] * channels[ch][i];
      }
      sampleSum /= numChannels;

      rmsSum += sampleSum;
      if (i >= windowSamples) {
        let oldSum = 0;
        for (let ch = 0; ch < numChannels; ch++) {
          oldSum += channels[ch][i - windowSamples] * channels[ch][i - windowSamples];
        }
        rmsSum -= oldSum / numChannels;
      }

      const windowSize = Math.min(i + 1, windowSamples);
      rmsEnvelope[i] = Math.sqrt(rmsSum / windowSize);
    }

    const peakEnvelope = new Float32Array(length);
    const peakAttack = Math.exp(-1 / (0.001 * sampleRate));
    const peakRelease = Math.exp(-1 / (0.050 * sampleRate));
    let peakLevel = 0;

    for (let i = 0; i < length; i++) {
      let peak = 0;
      for (let ch = 0; ch < numChannels; ch++) {
        peak = Math.max(peak, Math.abs(channels[ch][i]));
      }

      if (peak > peakLevel) {
        peakLevel = peakAttack * peakLevel + (1 - peakAttack) * peak;
      } else {
        peakLevel = peakRelease * peakLevel + (1 - peakRelease) * peak;
      }
      peakEnvelope[i] = peakLevel;
    }

    const transientThresholdDB = 10;
    for (let i = 0; i < length; i++) {
      if (rmsEnvelope[i] > 0.0001) {
        const crestFactorDB = 20 * Math.log10(peakEnvelope[i] / rmsEnvelope[i]);
        transientMap[i] = Math.min(1, Math.max(0, (crestFactorDB - 6) / (transientThresholdDB - 6)));
      } else {
        transientMap[i] = 0;
      }
    }
  }

  sendProgress(id, 0.3, 'Calculating gain envelope...');

  // Calculate gain envelope with lookahead
  const gainEnvelope = new Float32Array(length);
  gainEnvelope.fill(1.0);

  const prevSamplesL = [0, 0, 0, 0];
  const prevSamplesR = numChannels > 1 ? [0, 0, 0, 0] : null;

  for (let i = 0; i < length; i++) {
    prevSamplesL[0] = prevSamplesL[1];
    prevSamplesL[1] = prevSamplesL[2];
    prevSamplesL[2] = prevSamplesL[3];
    prevSamplesL[3] = channels[0][i];

    let truePeak = 0;
    if (i >= 3) {
      truePeak = calculateTruePeakSample(prevSamplesL);
    }

    if (numChannels > 1 && prevSamplesR) {
      prevSamplesR[0] = prevSamplesR[1];
      prevSamplesR[1] = prevSamplesR[2];
      prevSamplesR[2] = prevSamplesR[3];
      prevSamplesR[3] = channels[1][i];

      if (i >= 3) {
        truePeak = Math.max(truePeak, calculateTruePeakSample(prevSamplesR));
      }
    }

    let effectiveCeiling = ceilingLinear;
    if (preserveTransients && transientMap && transientMap[i] > 0.5) {
      effectiveCeiling = ceilingLinear * Math.pow(10, transientMap[i] * 0.5 / 20);
    }

    let requiredGain = 1.0;
    if (truePeak > effectiveCeiling) {
      requiredGain = effectiveCeiling / truePeak;
    }

    const targetIndex = Math.max(0, i - lookaheadSamples);
    if (requiredGain < gainEnvelope[targetIndex]) {
      const range = Math.max(1, i - targetIndex);
      for (let j = targetIndex; j <= i; j++) {
        const progress = (j - targetIndex) / range;
        const smoothedGain = gainEnvelope[targetIndex] + (requiredGain - gainEnvelope[targetIndex]) * progress;
        gainEnvelope[j] = Math.min(gainEnvelope[j], smoothedGain);
      }
    }
  }

  // Smooth gain envelope (release)
  let currentGain = 1.0;
  for (let i = 0; i < length; i++) {
    if (gainEnvelope[i] < currentGain) {
      currentGain = gainEnvelope[i];
    } else {
      currentGain = releaseCoef * currentGain + (1 - releaseCoef) * 1.0;
      currentGain = Math.min(currentGain, 1.0);
    }
    gainEnvelope[i] = currentGain;
  }

  sendProgress(id, 0.6, 'Applying limiting...');

  // Apply gain and soft-knee
  const outputChannels = [];
  for (let ch = 0; ch < numChannels; ch++) {
    const input = channels[ch];
    const output = new Float32Array(length);

    // Apply gain reduction
    for (let i = 0; i < length; i++) {
      output[i] = input[i] * gainEnvelope[i];
    }

    // Apply soft-knee
    const softKneeOutput = applySoftKneeOversampled(output, ceilingLinear, kneeDB);
    for (let i = 0; i < length; i++) {
      output[i] = softKneeOutput[i];
    }

    outputChannels.push(output);

    sendProgress(id, 0.6 + 0.3 * ((ch + 1) / numChannels), `Processing channel ${ch + 1}/${numChannels}...`);
  }

  return outputChannels;
}

function applyTransparentLimiterToChannels(
  channels,
  sampleRate,
  ceilingLinear = LIMITER_DEFAULTS.CEILING_LINEAR,
  lookaheadMs = 5,
  releaseMs = 120
) {
  const numChannels = channels.length;
  const length = channels[0].length;
  const lookaheadSamples = Math.max(1, Math.floor(sampleRate * lookaheadMs / 1000));
  const releaseCoef = Math.exp(-1 / (releaseMs * sampleRate / 1000));
  const gainEnvelope = new Float32Array(length);
  gainEnvelope.fill(1.0);

  const histories = Array.from({ length: numChannels }, () => [0, 0, 0, 0]);

  for (let i = 0; i < length; i++) {
    let truePeak = 0;

    for (let ch = 0; ch < numChannels; ch++) {
      const history = histories[ch];
      history[0] = history[1];
      history[1] = history[2];
      history[2] = history[3];
      history[3] = channels[ch][i];

      if (i >= 3) {
        truePeak = Math.max(truePeak, calculateTruePeakSample(history));
      } else {
        truePeak = Math.max(truePeak, Math.abs(channels[ch][i]));
      }
    }

    if (truePeak <= ceilingLinear) {
      continue;
    }

    const requiredGain = ceilingLinear / truePeak;
    const start = Math.max(0, i - lookaheadSamples);
    const range = Math.max(1, i - start);

    for (let j = start; j <= i; j++) {
      const t = (j - start) / range;
      const interpolatedGain = 1 + (requiredGain - 1) * t;
      gainEnvelope[j] = Math.min(gainEnvelope[j], interpolatedGain);
    }
  }

  let currentGain = 1.0;
  for (let i = 0; i < length; i++) {
    if (gainEnvelope[i] < currentGain) {
      currentGain = gainEnvelope[i];
    } else {
      currentGain = releaseCoef * currentGain + (1 - releaseCoef) * 1.0;
      currentGain = Math.min(currentGain, 1.0);
    }
    gainEnvelope[i] = currentGain;
  }

  return channels.map((input) => {
    const output = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      output[i] = input[i] * gainEnvelope[i];
    }
    return output;
  });
}

/**
 * Normalize channels to target LUFS
 */
function normalizeChannelsToLUFS(channels, sampleRate, id, targetLUFS = -14, ceilingDB = -1) {
  sendProgress(id, 0.05, 'Measuring loudness...');

  const currentLUFS = measureLUFSFromChannels(channels, sampleRate, targetLUFS);
  const currentPeakDB = findTruePeakFromChannels(channels);

  console.log('[Worker LUFS] Current:', currentLUFS.toFixed(2), 'LUFS, Peak:', currentPeakDB.toFixed(2), 'dBTP');
  console.log('[Worker LUFS] Target:', targetLUFS, 'LUFS, Ceiling:', ceilingDB, 'dBTP');

  if (!isFinite(currentLUFS)) {
    console.warn('[Worker LUFS] Could not measure loudness, returning original');
    return { channels, currentLUFS, finalLUFS: currentLUFS, peakDB: currentPeakDB };
  }

  sendProgress(id, 0.15, 'Applying gain...');

  const lufsGainDB = targetLUFS - currentLUFS;
  const gainLinear = Math.pow(10, lufsGainDB / 20);
  const projectedPeakDB = currentPeakDB + lufsGainDB;
  const ceilingLinear = Math.pow(10, ceilingDB / 20);

  console.log('[Worker LUFS] Applying gain:', lufsGainDB.toFixed(2), 'dB');

  // Apply gain
  const gainedChannels = channels.map(ch => {
    const output = new Float32Array(ch.length);
    for (let i = 0; i < ch.length; i++) {
      output[i] = ch[i] * gainLinear;
    }
    return output;
  });

  // If peaks exceed ceiling, apply limiter
  if (projectedPeakDB > ceilingDB) {
    sendProgress(id, 0.25, 'Applying limiter...');
    console.log('[Worker LUFS] Projected peak:', projectedPeakDB.toFixed(2), 'dBTP exceeds ceiling, applying limiter');

    const limitedChannels = applyLookaheadLimiterToChannels(
      gainedChannels,
      sampleRate,
      id,
      ceilingLinear,
      3,
      100
    );

    const finalPeakDB = findTruePeakFromChannels(limitedChannels);
    const finalLUFS = measureLUFSFromChannels(limitedChannels, sampleRate);
    console.log('[Worker LUFS] After limiting - Peak:', finalPeakDB.toFixed(2), 'dBTP, LUFS:', finalLUFS.toFixed(2));

    return {
      channels: limitedChannels,
      currentLUFS,
      finalLUFS,
      peakDB: finalPeakDB,
      gainApplied: lufsGainDB,
      limiterApplied: true
    };
  }

  const finalLUFS = measureLUFSFromChannels(gainedChannels, sampleRate);

  return {
    channels: gainedChannels,
    currentLUFS,
    finalLUFS,
    peakDB: projectedPeakDB,
    gainApplied: lufsGainDB,
    limiterApplied: false
  };
}

// ============================================================================
// Spectral Noise Reduction (Worker-compatible version)
// ============================================================================

/**
 * Simple spectral noise reduction for worker
 * Uses frequency-selective attenuation targeting AI artifacts
 */
function applySpectralDenoiseToChannels(channels, sampleRate, id, amount = 0.3) {
  const numChannels = channels.length;
  const length = channels[0].length;
  const output = [];

  for (let ch = 0; ch < numChannels; ch++) {
    output.push(new Float32Array(length));
  }

  // Simple high-frequency attenuation using IIR lowpass
  // This is a simplified version - full FFT-based processing is in main DSP module
  const cutoffFreq = 12000 - amount * 4000; // 8-12kHz depending on amount
  const rc = 1.0 / (2 * Math.PI * cutoffFreq);
  const dt = 1.0 / sampleRate;
  const alpha = dt / (rc + dt);

  for (let ch = 0; ch < numChannels; ch++) {
    const input = channels[ch];
    const out = output[ch];
    let filtered = input[0];

    for (let i = 0; i < length; i++) {
      // Simple lowpass for high-frequency reduction
      filtered = filtered + alpha * (input[i] - filtered);

      // Blend based on amount
      const blend = amount * 0.5; // Max 50% wet
      out[i] = input[i] * (1 - blend) + filtered * blend;
    }

    sendProgress(id, 0.1 + 0.8 * (ch + 1) / numChannels, 'Reducing noise...');
  }

  return output;
}

// ============================================================================
// Saturation (Worker-compatible version)
// ============================================================================

/**
 * Apply saturation to channels
 */
function applySaturationToChannels(channels, sampleRate, id, drive = 0.5, thresholdDB = -18) {
  const numChannels = channels.length;
  const length = channels[0].length;
  const output = [];

  for (let ch = 0; ch < numChannels; ch++) {
    output.push(new Float32Array(length));
  }

  const driveAmount = 1 + drive * 3;
  const threshold = Math.pow(10, thresholdDB / 20);

  // Create bypass envelope based on signal level
  const windowMs = 50;
  const windowSamples = Math.floor(sampleRate * windowMs / 1000);
  const numWindows = Math.ceil(length / windowSamples);
  const bypassEnvelope = new Float32Array(numWindows);

  // Analyze levels for bypass
  for (let w = 0; w < numWindows; w++) {
    const start = w * windowSamples;
    const end = Math.min(start + windowSamples, length);
    let peak = 0;

    for (let i = start; i < end; i += 4) {
      for (let ch = 0; ch < numChannels; ch++) {
        peak = Math.max(peak, Math.abs(channels[ch][i]));
      }
    }

    bypassEnvelope[w] = peak >= threshold ? 1.0 : (peak / threshold) * (peak / threshold);
  }

  // Apply saturation
  for (let ch = 0; ch < numChannels; ch++) {
    const input = channels[ch];
    const out = output[ch];

    for (let i = 0; i < length; i++) {
      const windowIdx = Math.min(Math.floor(i / windowSamples), numWindows - 1);
      const wet = bypassEnvelope[windowIdx];

      const x = input[i];
      const absX = Math.abs(x);
      let saturated;

      if (absX < 0.7) {
        saturated = x;
      } else {
        saturated = Math.tanh(x * driveAmount) / Math.tanh(driveAmount);
      }

      out[i] = x * (1 - wet) + saturated * wet;
    }

    sendProgress(id, 0.1 + 0.8 * (ch + 1) / numChannels, 'Applying saturation...');
  }

  return output;
}

// ============================================================================
// Dynamic Leveler (Worker-compatible version)
// ============================================================================

/**
 * Apply dynamic leveling to channels
 */
function applyDynamicLevelingToChannels(channels, sampleRate, id, options = {}) {
  const numChannels = channels.length;
  const length = channels[0].length;
  const output = [];

  for (let ch = 0; ch < numChannels; ch++) {
    output.push(new Float32Array(length));
  }

  const windowMs = options.windowMs || 200;
  const quietThresholdDB = options.quietThresholdDB || -45;
  const expansionRatio = options.expansionRatio || 1.3;
  const maxGainDB = options.maxGainDB || 8;
  const crestThresholdDB = options.crestThresholdDB || 12;

  const windowSamples = Math.floor(sampleRate * windowMs / 1000);
  const numWindows = Math.ceil(length / windowSamples);
  const gainCurve = new Float32Array(numWindows);

  const quietThreshold = Math.pow(10, quietThresholdDB / 20);
  const maxGain = Math.pow(10, maxGainDB / 20);

  sendProgress(id, 0.2, 'Analyzing dynamics...');

  // Mix channels for analysis
  const mixed = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      mixed[i] += channels[ch][i] / numChannels;
    }
  }

  // Analyze each window
  for (let w = 0; w < numWindows; w++) {
    const start = w * windowSamples;
    const end = Math.min(start + windowSamples, length);

    let sumSq = 0;
    let peak = 0;
    let count = 0;

    for (let i = start; i < end; i += 4) {
      const sample = Math.abs(mixed[i]);
      sumSq += sample * sample;
      if (sample > peak) peak = sample;
      count++;
    }

    const rms = Math.sqrt(sumSq / count);
    const crestFactorDB = rms > 1e-6 ? 20 * Math.log10(peak / rms) : 0;

    let gain = 1.0;

    // Transient protection
    if (crestFactorDB > crestThresholdDB && peak > 0.05) {
      gain = Math.min(gain, 1.12);
    }

    // Quiet section expansion
    if (rms < quietThreshold && rms > 1e-8) {
      const rmsDB = 20 * Math.log10(rms);
      const expansionDB = (rmsDB - quietThresholdDB) * (expansionRatio - 1);
      gain *= Math.pow(10, Math.min(expansionDB, 6) / 20);
    }

    // Peak limiting
    if (peak * gain > 0.98) {
      gain *= 0.98 / (peak * gain);
    }

    gainCurve[w] = Math.max(1 / maxGain, Math.min(maxGain, gain));
  }

  // Smooth gain curve
  const smoothed = new Float32Array(numWindows);
  smoothed[0] = gainCurve[0];
  for (let i = 1; i < numWindows; i++) {
    smoothed[i] = smoothed[i - 1] * 0.9 + gainCurve[i] * 0.1;
  }

  sendProgress(id, 0.5, 'Applying gain automation...');

  // Apply gain curve
  for (let ch = 0; ch < numChannels; ch++) {
    const input = channels[ch];
    const out = output[ch];

    for (let i = 0; i < length; i++) {
      const windowIdx = Math.min(Math.floor(i / windowSamples), numWindows - 1);
      const nextIdx = Math.min(windowIdx + 1, numWindows - 1);
      const t = (i % windowSamples) / windowSamples;
      const gain = smoothed[windowIdx] * (1 - t) + smoothed[nextIdx] * t;

      out[i] = input[i] * gain;
    }

    sendProgress(id, 0.5 + 0.4 * (ch + 1) / numChannels, 'Applying gain automation...');
  }

  return output;
}

// ============================================================================
// Multiband Compression (Worker-compatible version)
// ============================================================================

/**
 * Calculate Linkwitz-Riley filter coefficients
 */
function calcLinkwitzRileyCoeffs(sampleRate, frequency, type) {
  const omega = 2 * Math.PI * frequency / sampleRate;
  const sin = Math.sin(omega);
  const cos = Math.cos(omega);
  const Q = 0.7071067811865476; // 1/sqrt(2) for Butterworth
  const alpha = sin / (2 * Q);

  let b0, b1, b2, a0, a1, a2;

  if (type === 'lowpass') {
    b0 = (1 - cos) / 2;
    b1 = 1 - cos;
    b2 = (1 - cos) / 2;
    a0 = 1 + alpha;
    a1 = -2 * cos;
    a2 = 1 - alpha;
  } else {
    b0 = (1 + cos) / 2;
    b1 = -(1 + cos);
    b2 = (1 + cos) / 2;
    a0 = 1 + alpha;
    a1 = -2 * cos;
    a2 = 1 - alpha;
  }

  return {
    b0: b0 / a0,
    b1: b1 / a0,
    b2: b2 / a0,
    a1: a1 / a0,
    a2: a2 / a0
  };
}

/**
 * Apply biquad filter for multiband
 */
function applyBiquadMB(samples, coeffs) {
  const output = new Float32Array(samples.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const { b0, b1, b2, a1, a2 } = coeffs;

  for (let i = 0; i < samples.length; i++) {
    const x0 = samples[i];
    const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x0; y2 = y1; y1 = y0;
    output[i] = y0;
  }

  return output;
}

/**
 * Compress a single band
 */
function compressBandWorker(samples, sampleRate, settings) {
  const { threshold = -20, ratio = 2.0, attack = 20, release = 100, makeup = 0 } = settings;
  const output = new Float32Array(samples.length);
  const thresholdLin = Math.pow(10, threshold / 20);
  const makeupLin = Math.pow(10, makeup / 20);

  const attackCoef = Math.exp(-1 / (attack * sampleRate / 1000));
  const releaseCoef = Math.exp(-1 / (release * sampleRate / 1000));

  let envelope = 0;

  for (let i = 0; i < samples.length; i++) {
    const inputAbs = Math.abs(samples[i]);

    if (inputAbs > envelope) {
      envelope = attackCoef * envelope + (1 - attackCoef) * inputAbs;
    } else {
      envelope = releaseCoef * envelope + (1 - releaseCoef) * inputAbs;
    }

    let gain = 1.0;
    if (envelope > thresholdLin) {
      const overDB = 20 * Math.log10(envelope / thresholdLin);
      const reductionDB = overDB * (1 - 1 / ratio);
      gain = Math.pow(10, -reductionDB / 20);
    }

    output[i] = samples[i] * gain * makeupLin;
  }

  return output;
}

/**
 * Apply multiband compression to channels
 */
function applyMultibandToChannels(channels, sampleRate, id, preset = 'balanced') {
  const presets = {
    gentle: {
      low: { threshold: -20, ratio: 2.0, attack: 30, release: 150, makeup: 0 },
      mid: { threshold: -18, ratio: 1.8, attack: 25, release: 120, makeup: 0 },
      high: { threshold: -16, ratio: 1.5, attack: 20, release: 100, makeup: 0 }
    },
    balanced: {
      low: { threshold: -24, ratio: 3.0, attack: 25, release: 120, makeup: 1 },
      mid: { threshold: -22, ratio: 2.2, attack: 20, release: 100, makeup: 1 },
      high: { threshold: -20, ratio: 2.0, attack: 15, release: 80, makeup: 1 }
    },
    aggressive: {
      low: { threshold: -28, ratio: 4.0, attack: 20, release: 100, makeup: 2 },
      mid: { threshold: -26, ratio: 2.8, attack: 18, release: 80, makeup: 2 },
      high: { threshold: -24, ratio: 2.5, attack: 12, release: 60, makeup: 2 }
    },
    master: {
      low: { threshold: -18, ratio: 2.5, attack: 30, release: 200, makeup: 0 },
      mid: { threshold: -16, ratio: 2.0, attack: 20, release: 150, makeup: 0 },
      high: { threshold: -14, ratio: 1.8, attack: 15, release: 100, makeup: 0 }
    }
  };

  const bandSettings = presets[preset] || presets.balanced;
  const lowMidFreq = 250;
  const midHighFreq = 5000;
  const numChannels = channels.length;
  const length = channels[0].length;
  const output = [];

  for (let ch = 0; ch < numChannels; ch++) {
    output.push(new Float32Array(length));
  }

  for (let ch = 0; ch < numChannels; ch++) {
    const input = channels[ch];

    // Split into bands using LR4 crossover
    const lpCoeffs1 = calcLinkwitzRileyCoeffs(sampleRate, lowMidFreq, 'lowpass');
    const hpCoeffs1 = calcLinkwitzRileyCoeffs(sampleRate, lowMidFreq, 'highpass');

    let low = applyBiquadMB(input, lpCoeffs1);
    low = applyBiquadMB(low, lpCoeffs1);

    let midHigh = applyBiquadMB(input, hpCoeffs1);
    midHigh = applyBiquadMB(midHigh, hpCoeffs1);

    const lpCoeffs2 = calcLinkwitzRileyCoeffs(sampleRate, midHighFreq, 'lowpass');
    const hpCoeffs2 = calcLinkwitzRileyCoeffs(sampleRate, midHighFreq, 'highpass');

    let mid = applyBiquadMB(midHigh, lpCoeffs2);
    mid = applyBiquadMB(mid, lpCoeffs2);

    let high = applyBiquadMB(midHigh, hpCoeffs2);
    high = applyBiquadMB(high, hpCoeffs2);

    sendProgress(id, 0.1 + 0.3 * (ch + 0.5) / numChannels, 'Splitting bands...');

    // Compress each band
    const compressedLow = compressBandWorker(low, sampleRate, bandSettings.low);
    const compressedMid = compressBandWorker(mid, sampleRate, bandSettings.mid);
    const compressedHigh = compressBandWorker(high, sampleRate, bandSettings.high);

    sendProgress(id, 0.4 + 0.4 * (ch + 0.5) / numChannels, 'Compressing bands...');

    // Sum bands
    for (let i = 0; i < length; i++) {
      output[ch][i] = compressedLow[i] + compressedMid[i] + compressedHigh[i];
    }

    sendProgress(id, 0.8 + 0.2 * (ch + 1) / numChannels, 'Summing bands...');
  }

  return output;
}

// ============================================================================
// Transient Shaper (Worker-compatible version)
// ============================================================================

/**
 * Apply transient shaping to channels
 */
function applyTransientShapingToChannels(channels, sampleRate, id, options = {}) {
  const attack = options.attack ?? 0.35;
  const sustain = options.sustain ?? -0.15;
  const sensitivity = options.sensitivity ?? 0.6;
  const attackTimeMs = 1;
  const releaseTimeMs = 50;
  const lookbackMs = 5;

  const numChannels = channels.length;
  const length = channels[0].length;
  const output = [];

  for (let ch = 0; ch < numChannels; ch++) {
    output.push(new Float32Array(length));
  }

  for (let ch = 0; ch < numChannels; ch++) {
    const input = channels[ch];

    // Detect envelope
    const envelope = new Float32Array(length);
    const attackSamples = attackTimeMs * sampleRate / 1000;
    const releaseSamples = (releaseTimeMs + (1 - sensitivity) * 100) * sampleRate / 1000;
    const attackCoef = Math.exp(-1 / Math.max(1, attackSamples));
    const releaseCoef = Math.exp(-1 / Math.max(1, releaseSamples));

    let level = 0;
    for (let i = 0; i < length; i++) {
      const abs = Math.abs(input[i]);
      if (abs > level) {
        level = attackCoef * level + (1 - attackCoef) * abs;
      } else {
        level = releaseCoef * level + (1 - releaseCoef) * abs;
      }
      envelope[i] = level;
    }

    sendProgress(id, 0.1 + 0.2 * (ch + 0.5) / numChannels, 'Detecting envelope...');

    // Detect transients from envelope derivative
    const lookback = Math.floor(lookbackMs * sampleRate / 1000);
    const transients = new Float32Array(length);

    for (let i = lookback; i < length; i++) {
      const diff = envelope[i] - envelope[i - lookback];
      if (diff > 0) {
        transients[i] = Math.min(1, diff * 20 * (0.5 + sensitivity));
      }
    }

    // Smooth transients
    const smoothWindow = Math.floor(0.002 * sampleRate);
    const smoothed = new Float32Array(length);

    for (let i = smoothWindow; i < length - smoothWindow; i++) {
      let sum = 0;
      for (let j = -smoothWindow; j <= smoothWindow; j++) {
        sum += transients[i + j];
      }
      smoothed[i] = sum / (smoothWindow * 2 + 1);
    }

    sendProgress(id, 0.3 + 0.3 * (ch + 0.5) / numChannels, 'Detecting transients...');

    // Detect sustain (inverse of transients)
    const sustainMap = new Float32Array(length);
    const threshold = 0.001;

    for (let i = 0; i < length; i++) {
      if (envelope[i] > threshold) {
        sustainMap[i] = Math.max(0, 1 - smoothed[i] * 2);
      }
    }

    // Apply shaping
    for (let i = 0; i < length; i++) {
      let gain = 1.0;

      if (smoothed[i] > 0.1) {
        gain *= 1 + attack * 0.5 * smoothed[i];
      }

      if (sustainMap[i] > 0.1) {
        gain *= 1 + sustain * 0.3 * sustainMap[i];
      }

      output[ch][i] = input[i] * gain;
    }

    sendProgress(id, 0.6 + 0.4 * (ch + 1) / numChannels, 'Applying shaping...');
  }

  return output;
}

// ============================================================================
// Stereo Processing (Worker-compatible version)
// ============================================================================

/**
 * Apply stereo processing to channels
 */
function applyStereoProcessingToChannels(channels, sampleRate, id, options = {}) {
  if (channels.length !== 2) {
    console.warn('[Worker Stereo] Not stereo, returning unchanged');
    return channels;
  }

  const report = (progress, status) => {
    if (id === null || id === undefined) return;
    sendProgress(id, progress, status);
  };

  const width = options.width ?? 1.0;
  const bassMono = options.bassMono ?? true;
  const bassFreq = options.bassFreq ?? 200;
  const balance = options.balance ?? 0.0;
  const midGain = options.midGain ?? 0;
  const sideGain = options.sideGain ?? 0;
  const depth = clamp01(options.depth ?? 0);

  const left = channels[0];
  const right = channels[1];
  const length = left.length;

  const outLeft = new Float32Array(length);
  const outRight = new Float32Array(length);

  // Encode to M/S
  const mid = new Float32Array(length);
  const side = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    mid[i] = (left[i] + right[i]) * 0.5;
    side[i] = (left[i] - right[i]) * 0.5;
  }

  report(0.2, 'M/S encoding...');

  // Apply bass mono (highpass on side)
  let processedSide = side;
  if (bassMono && bassFreq > 0) {
    const omega = 2 * Math.PI * bassFreq / sampleRate;
    const cos = Math.cos(omega);
    const sin = Math.sin(omega);
    const alpha = sin / (2 * 0.7071);

    const b0 = ((1 + cos) / 2) / (1 + alpha);
    const b1 = (-(1 + cos)) / (1 + alpha);
    const b2 = ((1 + cos) / 2) / (1 + alpha);
    const a1 = (-2 * cos) / (1 + alpha);
    const a2 = (1 - alpha) / (1 + alpha);

    processedSide = new Float32Array(length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;

    for (let i = 0; i < length; i++) {
      const x0 = side[i];
      const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = x0; y2 = y1; y1 = y0;
      processedSide[i] = y0;
    }
  }

  report(0.4, 'Bass mono filter...');

  // Apply width and gains
  const midGainLin = Math.pow(10, midGain / 20);
  const sideGainLin = Math.pow(10, sideGain / 20) * width;

  const processedMid = new Float32Array(length);
  const processedSideFinal = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    processedMid[i] = mid[i] * midGainLin;
    processedSideFinal[i] = processedSide[i] * sideGainLin;
  }

  const depthEnhancedSide = depth > 0
    ? enhanceStereoDepth(processedSideFinal, sampleRate, depth)
    : processedSideFinal;

  report(0.6, 'Applying width...');

  // Decode back to L/R
  for (let i = 0; i < length; i++) {
    outLeft[i] = processedMid[i] + depthEnhancedSide[i];
    outRight[i] = processedMid[i] - depthEnhancedSide[i];
  }

  // Apply balance
  const balanceL = balance < 0 ? 1 : 1 - balance;
  const balanceR = balance > 0 ? 1 : 1 + balance;

  for (let i = 0; i < length; i++) {
    outLeft[i] *= balanceL;
    outRight[i] *= balanceR;
  }

  report(1.0, 'Complete');

  return [outLeft, outRight];
}

function calcPeakingCoeffs(sampleRate, frequency, gainDB, Q) {
  const A = Math.pow(10, gainDB / 40);
  const w0 = 2 * Math.PI * frequency / sampleRate;
  const alpha = Math.sin(w0) / (2 * Q);
  const cosW0 = Math.cos(w0);
  const b0 = 1 + alpha * A;
  const b1 = -2 * cosW0;
  const b2 = 1 - alpha * A;
  const a0 = 1 + alpha / A;
  const a1 = -2 * cosW0;
  const a2 = 1 - alpha / A;
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

function calcLowShelfCoeffs(sampleRate, frequency, gainDB, Q) {
  const A = Math.pow(10, gainDB / 40);
  const w0 = 2 * Math.PI * frequency / sampleRate;
  const alpha = Math.sin(w0) / (2 * Q);
  const cosW0 = Math.cos(w0);
  const sqrtA = Math.sqrt(A);
  const b0 = A * ((A + 1) - (A - 1) * cosW0 + 2 * sqrtA * alpha);
  const b1 = 2 * A * ((A - 1) - (A + 1) * cosW0);
  const b2 = A * ((A + 1) - (A - 1) * cosW0 - 2 * sqrtA * alpha);
  const a0 = (A + 1) + (A - 1) * cosW0 + 2 * sqrtA * alpha;
  const a1 = -2 * ((A - 1) + (A + 1) * cosW0);
  const a2 = (A + 1) + (A - 1) * cosW0 - 2 * sqrtA * alpha;
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

function applyEQBand(buffer, coeffs) {
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    const filtered = applyBiquadFilter(data, coeffs);
    buffer.copyToChannel(filtered, ch);
  }
  return buffer;
}

/**
 * Apply 5-Band EQ + Cut Mud
 */
function applyParametricEQ(buffer, settings) {
  const sampleRate = buffer.sampleRate;

  // Support both legacy `settings.eqValues` and flattened `settings.eqLow` style keys.
  const eqValues = settings.eqValues || {
    low: Number(settings.eqLow) || 0,
    lowMid: Number(settings.eqLowMid) || 0,
    mid: Number(settings.eqMid) || 0,
    highMid: Number(settings.eqHighMid) || 0,
    high: Number(settings.eqHigh) || 0
  };

  let outBuffer = buffer;

  // 1. Low Shelf (80Hz)
  if (eqValues.low !== 0) {
    outBuffer = applyEQBand(outBuffer, calcLowShelfCoeffs(sampleRate, 80, eqValues.low, 0.707));
  }

  // 2. Low Mid (250Hz)
  if (eqValues.lowMid !== 0) {
    outBuffer = applyEQBand(outBuffer, calcPeakingCoeffs(sampleRate, 250, eqValues.lowMid, 1.0));
  }

  // 3. Mid (1kHz)
  if (eqValues.mid !== 0) {
    outBuffer = applyEQBand(outBuffer, calcPeakingCoeffs(sampleRate, 1000, eqValues.mid, 1.0));
  }

  // 4. High Mid (4kHz)
  if (eqValues.highMid !== 0) {
    outBuffer = applyEQBand(outBuffer, calcPeakingCoeffs(sampleRate, 4000, eqValues.highMid, 1.0));
  }

  // 5. High Shelf (12kHz)
  if (eqValues.high !== 0) {
    outBuffer = applyEQBand(outBuffer, calcHighShelfCoeffs(sampleRate, 12000, eqValues.high, 0.707));
  }

  const mudCutDb = Number(settings.mudCutDb);

  // 6. Cut Mud (250Hz, scalable attenuation)
  if (Number.isFinite(mudCutDb) && mudCutDb < 0) {
    outBuffer = applyEQBand(outBuffer, calcPeakingCoeffs(sampleRate, 250, mudCutDb, 1.5));
  } else if (settings.cutMud) {
    outBuffer = applyEQBand(outBuffer, calcPeakingCoeffs(sampleRate, 250, -3.0, 1.5));
  }

  return outBuffer;
}

/**
 * Apply Glue Compressor (Stereo Linked)
 */
function applyGlueCompressor(buffer, options) {
  const { threshold, ratio, attack, release } = options;
  const sampleRate = buffer.sampleRate;
  const numChannels = buffer.numberOfChannels;

  // Extract channels
  const channels = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }

  const length = channels[0].length;
  // Use linked (average) sidechain for stereo stability
  const sidechain = new Float32Array(length);

  if (numChannels >= 2) {
    for (let i = 0; i < length; i++) {
      sidechain[i] = (channels[0][i] + channels[1][i]) * 0.5;
    }
  } else {
    sidechain.set(channels[0]);
  }

  // Compression Envelope
  const thresholdLin = Math.pow(10, threshold / 20);
  const attackCoef = Math.exp(-1 / (attack * sampleRate));
  const releaseCoef = Math.exp(-1 / (release * sampleRate));

  let envelope = 0;
  const gainCurve = new Float32Array(length);

  // Detect & Calculate Gain
  for (let i = 0; i < length; i++) {
    const inputAbs = Math.abs(sidechain[i]);

    // Smooth envelope
    if (inputAbs > envelope) {
      envelope = attackCoef * envelope + (1 - attackCoef) * inputAbs;
    } else {
      envelope = releaseCoef * envelope + (1 - releaseCoef) * inputAbs;
    }

    // Intentional hard-knee glue compression.
    let gain = 1.0;
    if (envelope > thresholdLin) {
      const overDB = 20 * Math.log10(envelope / thresholdLin);
      const reductionDB = overDB * (1 - 1 / ratio);
      gain = Math.pow(10, -reductionDB / 20);
    }
    gainCurve[i] = gain;
  }

  // Apply Gain to all channels
  const outBuffer = new WorkerAudioBuffer({
    numberOfChannels: numChannels,
    length: length,
    sampleRate: sampleRate
  });

  for (let c = 0; c < numChannels; c++) {
    const input = channels[c];
    const output = outBuffer.getChannelData(c);
    for (let i = 0; i < length; i++) {
      output[i] = input[i] * gainCurve[i];
    }
  }

  return outBuffer;
}

function hasLinearOnlySettings(settings) {
  const eqValues = [
    Number(settings.eqLow) || 0,
    Number(settings.eqLowMid) || 0,
    Number(settings.eqMid) || 0,
    Number(settings.eqHighMid) || 0,
    Number(settings.eqHigh) || 0
  ];

  const clarityAmount = normalizeAmount(settings.clarityAmount);
  const airAmount = normalizeAmount(settings.airAmount);
  const warmthAmount = normalizeAmount(settings.warmthAmount);
  const lowEndCleanAmount = normalizeAmount(settings.lowEndCleanAmount);
  const glueAmount = normalizeAmount(settings.glueCompressionAmount);
  const autoLevelAmount = normalizeAmount(settings.autoLevelAmount);
  const depthAmount = normalizeAmount(settings.spaceDepthAmount);

  return (
    clarityAmount === 0 &&
    airAmount === 0 &&
    warmthAmount === 0 &&
    autoLevelAmount === 0 &&
    lowEndCleanAmount === 0 &&
    glueAmount === 0 &&
    depthAmount === 0 &&
    !settings.centerBass &&
    Math.abs((Number(settings.stereoWidth) || 100) - 100) < 1e-6 &&
    eqValues.every((value) => value === 0)
  );
}

function applyTransparentGain(buffer, gainDB) {
  if (!gainDB) {
    return buffer;
  }

  return applyGain(buffer, gainDB);
}

function keepLinearHeadroom(buffer, ceilingDB) {
  const peakDB = findTruePeak(buffer);
  if (!Number.isFinite(peakDB) || peakDB <= ceilingDB) {
    return buffer;
  }

  return applyTransparentGain(buffer, ceilingDB - peakDB);
}

function normalizeToLUFSTransparent(buffer, targetLUFS, ceilingDB) {
  let workingBuffer = buffer;

  for (let pass = 0; pass < 3; pass++) {
    const currentLUFS = measureLUFS(workingBuffer, targetLUFS);
    if (!Number.isFinite(currentLUFS)) {
      return keepLinearHeadroom(workingBuffer, ceilingDB);
    }

    const gainDB = targetLUFS - currentLUFS;
    if (Math.abs(gainDB) < 0.15) {
      break;
    }

    workingBuffer = applyTransparentGain(workingBuffer, gainDB);

    if (findTruePeak(workingBuffer) > ceilingDB) {
      const limitedChannels = applyTransparentLimiterToChannels(
        Array.from({ length: workingBuffer.numberOfChannels }, (_, ch) =>
          workingBuffer.getChannelData(ch)
        ),
        workingBuffer.sampleRate,
        Math.pow(10, ceilingDB / 20)
      );

      const limitedBuffer = new AudioBuffer({
        numberOfChannels: workingBuffer.numberOfChannels,
        length: workingBuffer.length,
        sampleRate: workingBuffer.sampleRate
      });

      for (let ch = 0; ch < limitedChannels.length; ch++) {
        limitedBuffer.copyToChannel(limitedChannels[ch], ch);
      }

      workingBuffer = limitedBuffer;
    }
  }

  return keepLinearHeadroom(workingBuffer, ceilingDB);
}

// ============================================================================
// Message Handler
// ============================================================================
self.onmessage = async (e) => {
  const { type, id, data } = e.data;

  try {
    let result;

    switch (type) {
      case 'MEASURE_LUFS': {
        const lufs = measureLUFSFromChannels(data.channels, data.sampleRate);
        result = { lufs };
        break;
      }

      case 'FIND_TRUE_PEAK': {
        const peakDB = findTruePeakFromChannels(data.channels);
        result = { peakDB };
        break;
      }

      case 'NORMALIZE': {
        const normalized = normalizeChannelsToLUFS(
          data.channels,
          data.sampleRate,
          id,
          data.targetLUFS,
          data.ceilingDB
        );
        // Transfer the channel buffers back
        result = normalized;
        break;
      }

      case 'APPLY_LIMITER': {
        const limited = applyLookaheadLimiterToChannels(
          data.channels,
          data.sampleRate,
          id,
          data.ceilingLinear || LIMITER_DEFAULTS.CEILING_LINEAR,
          data.lookaheadMs || LIMITER_DEFAULTS.LOOKAHEAD_MS,
          data.releaseMs || LIMITER_DEFAULTS.RELEASE_MS,
          data.kneeDB || LIMITER_DEFAULTS.KNEE_DB,
          data.preserveTransients !== false
        );
        result = { channels: limited };
        break;
      }

      case 'SPECTRAL_DENOISE': {
        sendProgress(id, 0.1, 'Analyzing noise profile...');
        const denoised = applySpectralDenoiseToChannels(
          data.channels,
          data.sampleRate,
          id,
          data.amount || 0.3
        );
        result = { channels: denoised };
        break;
      }

      case 'APPLY_SATURATION': {
        sendProgress(id, 0.1, 'Applying saturation...');
        const saturated = applySaturationToChannels(
          data.channels,
          data.sampleRate,
          id,
          data.drive || 0.5,
          data.thresholdDB || -18
        );
        result = { channels: saturated };
        break;
      }

      case 'APPLY_DYNAMIC_LEVELING': {
        sendProgress(id, 0.1, 'Analyzing dynamics...');
        const leveled = applyDynamicLevelingToChannels(
          data.channels,
          data.sampleRate,
          id,
          data.options || {}
        );
        result = { channels: leveled };
        break;
      }

      case 'APPLY_MULTIBAND': {
        sendProgress(id, 0.1, 'Splitting into bands...');
        const multiband = applyMultibandToChannels(
          data.channels,
          data.sampleRate,
          id,
          data.preset || 'balanced'
        );
        result = { channels: multiband };
        break;
      }

      case 'APPLY_TRANSIENT_SHAPING': {
        sendProgress(id, 0.1, 'Detecting transients...');
        const shaped = applyTransientShapingToChannels(
          data.channels,
          data.sampleRate,
          id,
          data.options || {}
        );
        result = { channels: shaped };
        break;
      }

      case 'APPLY_STEREO_PROCESSING': {
        sendProgress(id, 0.1, 'Processing stereo...');
        const stereo = applyStereoProcessingToChannels(
          data.channels,
          data.sampleRate,
          id,
          data.options || {}
        );
        result = { channels: stereo };
        break;
      }

      case 'RENDER_FULL_CHAIN': {
        // Render the full DSP chain (for cached buffer architecture)
        // Hybrid Pipeline:
        // - PREVIEW: Runs "Heavy" FX only (Deharsh, Exciter, Warmth, Punch)
        // - EXPORT: Runs Full Chain (Heavy FX + EQ + Comp + Limit)
        const { channels, sampleRate, settings, mode = 'preview' } = data;

        sendProgress(id, 0.05, 'Creating audio buffer...');

        // Create WorkerAudioBuffer from channel data
        let buffer = new WorkerAudioBuffer({
          numberOfChannels: channels.length,
          length: channels[0].length,
          sampleRate: sampleRate
        });
        for (let ch = 0; ch < channels.length; ch++) {
          buffer.copyToChannel(channels[ch], ch);
        }

        // Track level through the chain
        console.log(`[Worker Chain] Starting render (Mode: ${mode})`);

        const clarityAmount = normalizeAmount(settings.clarityAmount);
        const airAmount = normalizeAmount(settings.airAmount);
        const warmthAmount = normalizeAmount(settings.warmthAmount);
        const lowEndCleanAmount = normalizeAmount(settings.lowEndCleanAmount);
        const glueAmount = normalizeAmount(settings.glueCompressionAmount);
        const autoLevelAmount = normalizeAmount(settings.autoLevelAmount);
        const depthAmount = normalizeAmount(settings.spaceDepthAmount);
        const truePeakCeiling = settings.truePeakCeiling || -1;

        // --- HEAVY FX (Shared) ---

        // 0. Input Gain (pre-FX, pre-limiter)
        const inputGainDb = Number(settings.inputGain) || 0;
        if (inputGainDb !== 0) {
          sendProgress(id, 0.10, 'Applying input gain...');
          const gainLin = Math.pow(10, inputGainDb / 20);
          for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
            const channelData = buffer.getChannelData(ch);
            for (let i = 0; i < channelData.length; i++) {
              channelData[i] *= gainLin;
            }
          }
        }

        // 1. Deharsh / Hybrid Dynamic Processor (if enabled)
        if (clarityAmount > 0) {
          sendProgress(id, 0.15, 'Applying hybrid dynamic processor...');
          buffer = applyClarityProcessing(buffer, clarityAmount);
        }

        // 2. Exciter / Add Air (if enabled)
        if (airAmount > 0) {
          sendProgress(id, 0.3, 'Applying exciter...');
          buffer = applyAirProcessing(buffer, airAmount);
        }

        // 3. Multiband Saturation / Tape Warmth (if enabled)
        if (warmthAmount > 0) {
          sendProgress(id, 0.45, 'Applying multiband saturation...');
          buffer = applyWarmthProcessing(buffer, warmthAmount);
        }

        // 4. Dynamic leveling / Auto level strength
        if (autoLevelAmount > 0) {
          sendProgress(id, 0.55, 'Applying auto leveling...');
          buffer = applyAutoLevelProcessing(buffer, autoLevelAmount, truePeakCeiling);
        }

        // 4.5 Optional transient enhancement for high punch settings
        if (autoLevelAmount >= 0.55) {
          sendProgress(id, 0.58, 'Applying transient enhancement...');
          const transientWet = applyMultibandTransient(buffer);
          buffer = mixBuffers(buffer, transientWet, 0.10 + (autoLevelAmount - 0.55) * 0.35);
        }

        // --- PREVIEW MODE END ---
        if (mode === 'preview') {
          console.log('[Worker Chain] Preview render complete (Heavy FX only)');
          sendProgress(id, 1.0, 'Complete');

          // Extract and return
          const outputChannels = [];
          const transferables = [];
          for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
            const channelData = buffer.getChannelData(ch).slice();
            outputChannels.push(channelData);
            transferables.push(channelData.buffer);
          }

          result = {
            channels: outputChannels,
            lufs: measureLUFS(buffer), // LUFS of pre-processed (not final)
            measuredLufs: measureLUFS(buffer)
          };

          self.postMessage({ id, success: true, result }, transferables);
          return;
        }

        // --- EXPORT MODE ONLY (Live Chain Simulation) ---
        // Includes: Final Filters, EQ, Cut Mud, Glue Comp, Soft Clip, Limit
        if (hasLinearOnlySettings(settings)) {
          sendProgress(id, 0.70, 'Applying transparent gain...');

          if (settings.normalizeLoudness && settings.targetLufs) {
            buffer = normalizeToLUFSTransparent(
              buffer,
              settings.targetLufs,
              settings.truePeakCeiling || -1
            );
          } else {
            buffer = keepLinearHeadroom(buffer, settings.truePeakCeiling || -1);
          }

          const finalLufs = measureLUFS(buffer);
          const outputChannels = [];
          const transferables = [];
          for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
            const channelData = buffer.getChannelData(ch).slice();
            outputChannels.push(channelData);
            transferables.push(channelData.buffer);
          }

          result = {
            channels: outputChannels,
            lufs: finalLufs,
            measuredLufs: finalLufs
          };

          sendProgress(id, 1.0, 'Complete');
          self.postMessage({ id, success: true, result }, transferables);
          return;
        }

        // 5. Final Filters (HPF 30Hz / LPF 18k)
        // HPF is controlled by Clean Low End; LPF is always applied as final cleanup.
        sendProgress(id, 0.60, 'Applying final filters...');
        buffer = applyFinalFilters(buffer, {
          highpass: lowEndCleanAmount > 0,
          highpassFreq: 22 + lowEndCleanAmount * 18,
          lowpass: settings.presetId !== 'none'
        });

        // 6. EQ (5-Band) + Cut Mud
        sendProgress(id, 0.65, 'Applying EQ...');
        buffer = applyParametricEQ(buffer, {
          ...settings,
          mudCutDb: lowEndCleanAmount > 0 ? -(0.5 + lowEndCleanAmount * 2.5) : 0
        });

        // 7. Glue Compressor
        if (glueAmount > 0) {
          sendProgress(id, 0.70, 'Applying glue compressor...');
          const glued = applyGlueCompressor(buffer, {
            threshold: -12 - glueAmount * 10,
            ratio: 1.35 + glueAmount * 1.9,
            attack: 0.03 - glueAmount * 0.018,
            release: 0.28 - glueAmount * 0.12
          });
          buffer = mixBuffers(buffer, glued, 0.22 + glueAmount * 0.48);
        }

        // 7.5 Stereo processing (Width + Center Bass)
        // Mirrors the WebAudio M/S width stage used in the app's live chain.
        if (buffer.numberOfChannels === 2) {
          const stereoWidthValue = Number(settings.stereoWidth);
          const width = Number.isFinite(stereoWidthValue) ? stereoWidthValue / 100 : 1.0;
          const clampedWidth = Math.max(0, Math.min(2, width));
          const bassMono = !!settings.centerBass;
          const sideGain = depthAmount * 0.9;
          const midGain = -depthAmount * 0.45;

          if (bassMono || Math.abs(clampedWidth - 1.0) > 1e-6 || depthAmount > 0) {
            sendProgress(id, 0.72, 'Applying stereo processing...');
            const processed = applyStereoProcessingToChannels(
              [buffer.getChannelData(0), buffer.getChannelData(1)],
              buffer.sampleRate,
              null,
              {
                width: clampedWidth,
                bassMono,
                bassFreq: bassMono ? 200 : 160,
                midGain,
                sideGain,
                depth: depthAmount
              }
            );
            buffer.copyToChannel(processed[0], 0);
            buffer.copyToChannel(processed[1], 1);
          }
        }

        // 8. Normalize & Limit (Corrected Order)
        if (settings.normalizeLoudness && settings.targetLufs) {
          sendProgress(id, 0.75, 'Analyzing loudness...');
          const targetLufs = settings.targetLufs;
          // Apply Gain (No Limiting yet, skipLimiter: true)
          buffer = normalizeToLUFS(buffer, targetLufs, 0, { skipLimiter: true });
        }

        // 9. Final True Peak Limiter
        if (settings.truePeakLimit) {
          sendProgress(id, 0.92, 'Applying final limiter...');
          const ceiling = settings.truePeakCeiling || -1;
          const limitedChannels = applyTransparentLimiterToChannels(
            Array.from({ length: buffer.numberOfChannels }, (_, ch) =>
              buffer.getChannelData(ch)
            ),
            buffer.sampleRate,
            Math.pow(10, ceiling / 20),
            5,
            120
          );

          for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
            buffer.copyToChannel(limitedChannels[ch], ch);
          }
        }

        // Measure final LUFS
        const finalLufs = measureLUFS(buffer);
        const outputChannels = [];
        const transferables = [];
        for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
          const channelData = buffer.getChannelData(ch).slice();
          outputChannels.push(channelData);
          transferables.push(channelData.buffer);
        }

        result = {
          channels: outputChannels,
          lufs: finalLufs,
          measuredLufs: finalLufs
        };

        sendProgress(id, 1.0, 'Complete');
        self.postMessage({ id, success: true, result }, transferables);
        return;
      }

      default:
        throw new Error(`Unknown message type: ${type}`);
    }

    sendProgress(id, 1.0, 'Complete');
    self.postMessage({ id, success: true, result });

  } catch (error) {
    console.error('[Worker] Error:', error);
    self.postMessage({ id, success: false, error: error.message });
  }
};

console.log('[DSP Worker] Initialized');
