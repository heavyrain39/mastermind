import type { IAudioMetadata } from "music-metadata-browser";
import type { DitherMode } from "../../shared/types/mastering";

interface WavEncodeOptions {
  bitDepth?: 16 | 24;
  ditherMode?: DitherMode;
  metadata?: IAudioMetadata;
}

const DITHER_BUFFER_SIZE = 512;
const ditherBuffer = new Float32Array(DITHER_BUFFER_SIZE);
let ditherIndex = 0;
fillDitherBuffer();

export function audioBufferToWavBlob(audioBuffer: AudioBuffer, options: WavEncodeOptions = {}): Blob {
  const bytes = encodeAudioBufferToWav(audioBuffer, options);
  const safeBytes = new Uint8Array(bytes.byteLength);
  safeBytes.set(bytes);
  return new Blob([safeBytes.buffer], { type: "audio/wav" });
}

export function encodeAudioBufferToWav(
  audioBuffer: AudioBuffer,
  options: WavEncodeOptions = {}
): Uint8Array {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const bitDepth = options.bitDepth === 24 ? 24 : 16;
  const ditherMode = resolveDitherMode(options.ditherMode, bitDepth);
  const metadata = options.metadata;
  const bytesPerSample = bitDepth / 8;
  const length = audioBuffer.length;
  const dataSize = length * numberOfChannels * bytesPerSample;

  // Metadata (RIFF LIST INFO)
  const infoTags: { id: string; value: string }[] = [];
  if (metadata?.common) {
    const info = metadata.common;
    if (info.title) infoTags.push({ id: "INAM", value: info.title });
    if (info.artist) infoTags.push({ id: "IART", value: info.artist });
    if (info.album) infoTags.push({ id: "IPRD", value: info.album });
    if (info.year) infoTags.push({ id: "ICRD", value: String(info.year) });
    if (info.genre && info.genre[0]) infoTags.push({ id: "IGNR", value: info.genre[0] });
    if (info.comment && info.comment[0]) infoTags.push({ id: "ICMT", value: info.comment[0] });
  }

  let listSize = 0;
  if (infoTags.length > 0) {
    listSize = 4 + 8; // 'INFO' + 'LIST' header
    for (const tag of infoTags) {
      const valLen = tag.value.length + 1;
      const paddedLen = valLen + (valLen % 2);
      listSize += 8 + paddedLen;
    }
  }

  const headerSize = 44;
  const buffer = new ArrayBuffer(headerSize + dataSize + listSize);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize + listSize, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numberOfChannels * bytesPerSample, true);
  view.setUint16(32, numberOfChannels * bytesPerSample, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let channelIndex = 0; channelIndex < numberOfChannels; channelIndex += 1) {
    channels.push(audioBuffer.getChannelData(channelIndex));
  }

  let offset = headerSize;
  const noiseShapeError = ditherMode === "noise-shaped" ? new Float32Array(numberOfChannels) : null;
  const maxVal = bitDepth === 24 ? 8388607 : 32767;

  for (let sampleIndex = 0; sampleIndex < length; sampleIndex += 1) {
    for (let channelIndex = 0; channelIndex < numberOfChannels; channelIndex += 1) {
      const sample = clamp(channels[channelIndex][sampleIndex], -1, 1);
      const scaled = sample * maxVal;

      if (bitDepth === 16) {
        let quantizeInput = scaled;
        if (noiseShapeError) {
          quantizeInput += noiseShapeError[channelIndex];
        }
        if (ditherMode !== "none") {
          quantizeInput += triangularDither();
        }

        const integerSample = clamp(Math.round(quantizeInput), -32768, 32767);
        view.setInt16(offset, integerSample, true);
        offset += 2;

        if (noiseShapeError) {
          const quantError = quantizeInput - integerSample;
          noiseShapeError[channelIndex] = clamp(quantError * 0.85, -2, 2);
        }
      } else {
        const integerSample = clamp(Math.round(scaled), -8388607, 8388607);
        view.setUint8(offset, integerSample & 0xff);
        view.setUint8(offset + 1, (integerSample >> 8) & 0xff);
        view.setUint8(offset + 2, (integerSample >> 16) & 0xff);
        offset += 3;
      }
    }
  }

  // Write Metadata (LIST INFO)
  if (infoTags.length > 0) {
    writeString(view, offset, "LIST");
    view.setUint32(offset + 4, listSize - 8, true);
    writeString(view, offset + 8, "INFO");
    offset += 12;

    for (const tag of infoTags) {
      writeString(view, offset, tag.id);
      const valLen = tag.value.length + 1;
      view.setUint32(offset + 4, valLen, true);
      offset += 8;
      for (let i = 0; i < tag.value.length; i++) {
        view.setUint8(offset + i, tag.value.charCodeAt(i));
      }
      view.setUint8(offset + tag.value.length, 0); // null terminator
      offset += valLen;
      if (valLen % 2 !== 0) {
        view.setUint8(offset, 0); // padding
        offset += 1;
      }
    }
  }

  return new Uint8Array(buffer);
}

export async function resampleAudioBuffer(sourceBuffer: AudioBuffer, targetSampleRate: number) {
  if (!sourceBuffer || sourceBuffer.sampleRate === targetSampleRate) {
    return sourceBuffer;
  }

  const outputLength = Math.ceil(sourceBuffer.duration * targetSampleRate);
  const offlineContext = new OfflineAudioContext(
    sourceBuffer.numberOfChannels,
    outputLength,
    targetSampleRate
  );
  const source = offlineContext.createBufferSource();
  source.buffer = sourceBuffer;
  source.connect(offlineContext.destination);
  source.start(0);

  return offlineContext.startRendering();
}

function resolveDitherMode(mode: DitherMode | undefined, bitDepth: 16 | 24): DitherMode {
  if (bitDepth !== 16) return "none";
  return mode ?? "none";
}

function triangularDither() {
  const value = ditherBuffer[ditherIndex];
  ditherIndex += 1;
  if (ditherIndex >= DITHER_BUFFER_SIZE) {
    fillDitherBuffer();
    ditherIndex = 0;
  }
  return value;
}

function fillDitherBuffer() {
  for (let i = 0; i < DITHER_BUFFER_SIZE; i += 1) {
    ditherBuffer[i] = Math.random() + Math.random() - 1;
  }
}

function writeString(view: DataView, offset: number, value: string) {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
