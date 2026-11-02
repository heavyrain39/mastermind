import { EXCITER_DEFAULTS } from './constants.js';
import { interpolateCatmullRom } from './utils.js';

/**
 * Exciter defaults
 */
export { EXCITER_DEFAULTS }; // Re-export for convenience

/**
 * Calculate 2nd order Butterworth high-pass filter coefficients
 * @param {number} sampleRate - Sample rate
 * @param {number} frequency - Cutoff frequency
 * @returns {Object} Filter coefficients
 */
function calcHighPassCoeffs(sampleRate, frequency) {
  const omega = Math.tan(Math.PI * frequency / sampleRate);
  const omega2 = omega * omega;
  const sqrt2 = Math.SQRT2;
  const n = 1 / (1 + sqrt2 * omega + omega2);

  return {
    b0: n,
    b1: -2 * n,
    b2: n,
    a1: 2 * (omega2 - 1) * n,
    a2: (1 - sqrt2 * omega + omega2) * n
  };
}

/**
 * Apply 2nd order high-pass filter to samples
 * @param {Float32Array} samples - Input samples
 * @param {Object} coeffs - Filter coefficients
 * @returns {Float32Array} Filtered samples
 */
function applyHighPass(samples, coeffs) {
  const output = new Float32Array(samples.length);
  const { b0, b1, b2, a1, a2 } = coeffs;

  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;

  for (let i = 0; i < samples.length; i++) {
    const x0 = samples[i];
    const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;

    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = Math.abs(y0) < 1e-25 ? 0 : y0; // Denormal prevention

    output[i] = y1;
  }

  return output;
}

/**
 * Exciter class
 */
export class Exciter {
  /**
   * Create an exciter
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.hpfFreq = options.hpfFreq ?? EXCITER_DEFAULTS.hpfFreq;
    this.hpfSlope = options.hpfSlope ?? EXCITER_DEFAULTS.hpfSlope;
    this.drive = options.drive ?? EXCITER_DEFAULTS.drive;
    this.bias = options.bias ?? EXCITER_DEFAULTS.bias;
    this.mix = options.mix ?? EXCITER_DEFAULTS.mix;
    this.oversample = options.oversample ?? true; // Default to true for quality
    this.harmonicsOnly = options.harmonicsOnly ?? false;
  }

  /**
   * Process audio buffer with exciter
   * @param {AudioBuffer} buffer - Input audio buffer
   * @param {Function} onProgress - Progress callback (0-1)
   * @returns {AudioBuffer} Processed audio buffer
   */
  process(buffer, onProgress = null) {
    const output = new AudioBuffer({
      numberOfChannels: buffer.numberOfChannels,
      length: buffer.length,
      sampleRate: buffer.sampleRate
    });

    const hpfCoeffs = calcHighPassCoeffs(buffer.sampleRate, this.hpfFreq);
    const mixRatio = this.mix / 100;
    const drive = this.drive;
    const bias = this.bias;
    const biasOffset = Math.tanh(bias);
    // With harmonicsOnly, drop the shaper's linear term (the filtered highs
    // themselves). Those come back phase-shifted by the 24 dB/oct highpass and
    // cancelled the dry signal around the cutoff, so the exciter only adds the
    // harmonics and level changes are left to an EQ.
    const linearGain = this.harmonicsOnly ? drive * (1 - biasOffset * biasOffset) : 0;
    const shape = (x) => Math.tanh(x * drive + bias) - biasOffset - linearGain * x;

    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const input = buffer.getChannelData(ch);
      const out = output.getChannelData(ch);

      // Apply high-pass filter to isolate highs
      let filtered = applyHighPass(input, hpfCoeffs);

      // Apply second pass for 12dB/oct (LR2 equivalent)
      if (this.hpfSlope === 12) {
        filtered = applyHighPass(filtered, hpfCoeffs);
      }

      if (onProgress) onProgress((ch + 0.5) / buffer.numberOfChannels);

      // Apply saturation and parallel mix
      if (this.oversample) {
        // 2x oversampling: saturate the sample and both half-sample points
        // (Catmull-Rom), then downsample with a zero-phase [0.25, 0.5, 0.25].
        for (let i = 0; i < input.length; i++) {
          const p0 = filtered[i - 2] || 0;
          const p1 = filtered[i - 1] || 0;
          const p2 = filtered[i] || 0;
          const p3 = filtered[i + 1] || 0;
          const p4 = filtered[i + 2] || 0;

          const wetPrev = shape(interpolateCatmullRom(p0, p1, p2, p3, 0.5));
          const wetCurr = shape(p2);
          const wetNext = shape(interpolateCatmullRom(p1, p2, p3, p4, 0.5));
          const wet = wetPrev * 0.25 + wetCurr * 0.5 + wetNext * 0.25;

          out[i] = input[i] + wet * mixRatio;
        }

      } else {
        // Original non-oversampled loop
        for (let i = 0; i < input.length; i++) {
          const dry = input[i];
          // Parallel addition: dry + wet * mix (not blend)
          out[i] = dry + shape(filtered[i]) * mixRatio;
        }
      }

      if (onProgress) onProgress((ch + 1) / buffer.numberOfChannels);
    }

    return output;
  }
}

/**
 * Apply exciter with default settings (Add Air replacement)
 * @param {AudioBuffer} buffer - Input audio buffer
 * @param {Function} onProgress - Progress callback
 * @returns {AudioBuffer} Processed audio buffer
 */
export function applyExciter(buffer, onProgress = null) {
  const exciter = new Exciter();
  return exciter.process(buffer, onProgress);
}

/**
 * Apply exciter with custom settings
 * @param {AudioBuffer} buffer - Input audio buffer
 * @param {Object} options - Custom settings
 * @param {Function} onProgress - Progress callback
 * @returns {AudioBuffer} Processed audio buffer
 */
export function applyExciterWithOptions(buffer, options, onProgress = null) {
  const exciter = new Exciter(options);
  return exciter.process(buffer, onProgress);
}
