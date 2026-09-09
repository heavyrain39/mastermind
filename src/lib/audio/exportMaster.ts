import type { IAudioMetadata } from "music-metadata";
import type { TrackItem } from "../../shared/types/audio";
import type { MasteringSettings } from "../../shared/types/mastering";
import { resampleAudioBuffer } from "./wav";
import { encodeWavInWorker } from "./wavWorkerClient";
import { encodeMp3 } from "./mp3";

export async function exportMaster(
  track: TrackItem,
  settings: MasteringSettings,
  getDecodeContext: () => AudioContext,
  metadata?: IAudioMetadata,
  onProgress?: (percent: number) => void
): Promise<Blob> {
  if (!track.masteredUrl) throw new Error("No mastered audio available");
  const response = await fetch(track.masteredUrl);
  if (!response.ok) throw new Error(`Could not read mastered audio (${response.status})`);

  // Masters are stored as 24-bit WAV without dither. Reuse those exact bytes
  // when no format or metadata change is needed; 24-bit encoding ignores dither.
  if (
    settings.outputFormat === "wav" &&
    settings.bitDepth === 24 &&
    settings.sampleRate === track.masteredSampleRate &&
    metadata === track.masteredMetadata
  ) {
    return response.blob();
  }

  const decoded = await getDecodeContext().decodeAudioData(await response.arrayBuffer());
  const output = await resampleAudioBuffer(decoded, settings.sampleRate);
  if (settings.outputFormat === "mp3") {
    return encodeMp3(output, settings.mp3Bitrate, onProgress, metadata);
  }
  return encodeWavInWorker(output, {
    bitDepth: settings.bitDepth,
    ditherMode: settings.ditherMode,
    metadata
  });
}
