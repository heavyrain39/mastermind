import type { IAudioMetadata } from "music-metadata-browser";

export type TrackStatus = "idle" | "queued" | "processing" | "done" | "error";

export interface TrackItem {
  id: string;
  fileName: string;
  status: TrackStatus;
  selected: boolean;
  sizeBytes: number;
  addedAt: number;
  sourceFile: File;
  originalUrl: string;
  metadata?: IAudioMetadata;
  masteredUrl?: string;
  masteredFileName?: string;
  masteredSizeBytes?: number;
  originalLufs?: number;
  masteredLufs?: number;
  masteredPresetId?: string;
  progressPercent?: number;
  progressStatus?: string;
  errorMessage?: string;
  masteredBuffer?: AudioBuffer;
}
