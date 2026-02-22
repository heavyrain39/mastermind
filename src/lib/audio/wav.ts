import type { IAudioMetadata } from "music-metadata-browser";
import type { DitherMode } from "../../shared/types/mastering";
import { generateID3v2Tag } from "./mp3-tagger";

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

  // Metadata (RIFF LIST INFO + optional ID3 chunk)
  const textEncoder = new TextEncoder();
  const infoTags: { id: string; encoded: Uint8Array }[] = [];
  if (metadata?.common) {
    const info = metadata.common;
    const title = cleanInfoText(info.title);
    const artist = cleanInfoText(info.artist ?? info.artists?.[0] ?? info.albumartist);
    const album = cleanInfoText(info.album);
    const year = typeof info.year === "number" ? String(info.year) : undefined;
    const genre = cleanInfoText(info.genre?.[0]);
    const comment = cleanInfoText(info.comment?.[0]);

    if (title) infoTags.push({ id: "INAM", encoded: textEncoder.encode(title) });
    if (artist) infoTags.push({ id: "IART", encoded: textEncoder.encode(artist) });
    if (album) infoTags.push({ id: "IPRD", encoded: textEncoder.encode(album) });
    if (year) infoTags.push({ id: "ICRD", encoded: textEncoder.encode(year) });
    if (genre) infoTags.push({ id: "IGNR", encoded: textEncoder.encode(genre) });
    if (comment) infoTags.push({ id: "ICMT", encoded: textEncoder.encode(comment) });
  }

  let listSize = 0;
  if (infoTags.length > 0) {
    listSize = 4 + 8; // 'INFO' + 'LIST' header
    for (const tag of infoTags) {
      const valLen = tag.encoded.length + 1; // UTF-8 bytes + null terminator
      const paddedLen = valLen + (valLen % 2);
      listSize += 8 + paddedLen;
    }
  }

  const id3Data = generateID3v2Tag(metadata);
  const id3ChunkPayloadSize = id3Data.length > 0 ? id3Data.length + (id3Data.length % 2) : 0;
  const id3ChunkSize = id3ChunkPayloadSize > 0 ? 8 + id3ChunkPayloadSize : 0;

  const headerSize = 44;
  const buffer = new ArrayBuffer(headerSize + dataSize + listSize + id3ChunkSize);
  const view = new DataView(buffer);

  // RIFF Header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize + listSize + id3ChunkSize, true);
  writeString(view, 8, "WAVE");

  // fmt chunk (always 16 bytes for PCM)
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numberOfChannels * bytesPerSample, true);
  view.setUint16(32, numberOfChannels * bytesPerSample, true);
  view.setUint16(34, bitDepth, true);

  let offset = 36;

  // data chunk — must come before metadata for Windows Explorer compatibility
  writeString(view, offset, "data");
  view.setUint32(offset + 4, dataSize, true);
  offset += 8;

  const channels: Float32Array[] = [];
  for (let channelIndex = 0; channelIndex < numberOfChannels; channelIndex += 1) {
    channels.push(audioBuffer.getChannelData(channelIndex));
  }

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

  // Write metadata chunks after audio data (Windows Explorer requires this ordering)
  if (infoTags.length > 0) {
    writeString(view, offset, "LIST");
    view.setUint32(offset + 4, listSize - 8, true);
    writeString(view, offset + 8, "INFO");
    offset += 12;

    for (const tag of infoTags) {
      writeString(view, offset, tag.id);
      const valLen = tag.encoded.length + 1; // UTF-8 bytes + null terminator
      view.setUint32(offset + 4, valLen, true);
      offset += 8;
      for (let i = 0; i < tag.encoded.length; i++) {
        view.setUint8(offset + i, tag.encoded[i]);
      }
      view.setUint8(offset + tag.encoded.length, 0); // null terminator
      offset += valLen;
      if (valLen % 2 !== 0) {
        view.setUint8(offset, 0); // padding
        offset += 1;
      }
    }
  }

  // ID3 chunk for cover art and Unicode text support (read by PotPlayer, foobar2000 etc.)
  if (id3ChunkPayloadSize > 0) {
    writeString(view, offset, "id3 ");
    view.setUint32(offset + 4, id3Data.length, true);
    offset += 8;

    for (let i = 0; i < id3Data.length; i += 1) {
      view.setUint8(offset + i, id3Data[i]);
    }
    offset += id3Data.length;

    if (id3Data.length % 2 !== 0) {
      view.setUint8(offset, 0);
      offset += 1;
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

function cleanInfoText(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const stripped = value.replace(/\u0000/g, "").trim();
  return stripped.length > 0 ? stripped : undefined;
}
