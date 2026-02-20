export type DitherMode = "none" | "tpdf" | "noise-shaped";

export interface MasteringSettings {
  targetLufs: number;
  truePeakCeiling: number;
  outputTrimDb: number;
  normalizeLoudness: boolean;
  warmth: number;
  clarity: number;
  air: number;
  lowEndClean: number;
  stereoWidth: number;
  spaceDepth: number;
  monoBassAnchor: boolean;
  glueCompression: number;
  autoLevelStrength: number;
  sampleRate: 44100 | 48000;
  bitDepth: 16 | 24;
  ditherMode: DitherMode;
}

