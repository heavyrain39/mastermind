/**
 * Normalizer Module
 * LUFS loudness normalization with true peak limiting
 */

import { measureLUFS } from './lufs.js';
import { findTruePeak } from './true-peak.js';
import { applyLookaheadLimiter } from './limiter.js';
import { LIMITER_DEFAULTS, AUDIO_DEFAULTS } from './constants.js';

/**
 * Calculate the gain required to reach target LUFS
 * @param {AudioBuffer} audioBuffer - Input audio buffer
 * @param {number} targetLUFS - Target LUFS
 * @returns {number} Gain in dB
 */
export function calculateLufsGain(audioBuffer, targetLUFS = AUDIO_DEFAULTS.TARGET_LUFS) {
  const currentLUFS = measureLUFS(audioBuffer);

  if (!isFinite(currentLUFS)) {
    console.warn('[LUFS] Could not measure loudness, returning 0dB gain');
    return 0;
  }

  return targetLUFS - currentLUFS;
}

/**
 * Normalize an AudioBuffer to target LUFS by applying gain
 * Enforces true peak ceiling to prevent clipping unless disabled
 *
 * @param {AudioBuffer} audioBuffer - Input audio buffer
 * @param {number} targetLUFS - Target loudness in LUFS (default -14)
 * @param {number} ceilingDB - Maximum true peak ceiling in dB (default -1)
 * @param {Object} options - Options { skipLimiter: boolean }
 * @returns {AudioBuffer} Normalized audio buffer
 */
export function normalizeToLUFS(audioBuffer, targetLUFS = AUDIO_DEFAULTS.TARGET_LUFS, ceilingDB = LIMITER_DEFAULTS.CEILING_DB, options = {}) {
  const currentLUFS = measureLUFS(audioBuffer, targetLUFS);
  const currentPeakDB = findTruePeak(audioBuffer);

  if (!isFinite(currentLUFS)) {
    console.warn('[LUFS] Could not measure loudness, skipping normalization');
    return audioBuffer;
  }

  // Calculate gain needed to reach target LUFS
  const lufsGainDB = targetLUFS - currentLUFS;
  const gainLinear = Math.pow(10, lufsGainDB / 20);

  // Calculate what the peak will be after applying gain
  const projectedPeakDB = currentPeakDB + lufsGainDB;
  const ceilingLinear = Math.pow(10, ceilingDB / 20);

  // Create buffer with gain applied
  const gainedBuffer = new AudioBuffer({
    numberOfChannels: audioBuffer.numberOfChannels,
    length: audioBuffer.length,
    sampleRate: audioBuffer.sampleRate
  });

  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
    const input = audioBuffer.getChannelData(ch);
    const output = gainedBuffer.getChannelData(ch);
    for (let i = 0; i < input.length; i++) {
      output[i] = input[i] * gainLinear;
    }
  }

  // Skip limiter if requested
  if (options.skipLimiter) {
    return gainedBuffer;
  }

  // If peaks will exceed ceiling, apply lookahead limiter
  if (projectedPeakDB > ceilingDB) {
    return applyLookaheadLimiter(gainedBuffer, ceilingLinear, 3, 100);
  }

  return gainedBuffer;
}

/**
 * Apply gain to an AudioBuffer without normalization
 *
 * @param {AudioBuffer} audioBuffer - Input audio buffer
 * @param {number} gainDB - Gain to apply in dB
 * @returns {AudioBuffer} Gained audio buffer
 */
export function applyGain(audioBuffer, gainDB) {
  const gainLinear = Math.pow(10, gainDB / 20);

  const outputBuffer = new AudioBuffer({
    numberOfChannels: audioBuffer.numberOfChannels,
    length: audioBuffer.length,
    sampleRate: audioBuffer.sampleRate
  });

  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
    const input = audioBuffer.getChannelData(ch);
    const output = outputBuffer.getChannelData(ch);
    for (let i = 0; i < input.length; i++) {
      output[i] = input[i] * gainLinear;
    }
  }

  return outputBuffer;
}

/**
 * Normalize to target peak level (not LUFS)
 *
 * @param {AudioBuffer} audioBuffer - Input audio buffer
 * @param {number} targetPeakDB - Target peak level in dB
 * @returns {AudioBuffer} Normalized audio buffer
 */
export function normalizeToPeak(audioBuffer, targetPeakDB = -1) {
  const currentPeakDB = findTruePeak(audioBuffer);
  const gainDB = targetPeakDB - currentPeakDB;

  return applyGain(audioBuffer, gainDB);
}
