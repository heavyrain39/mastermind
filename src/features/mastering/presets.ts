import type { MasteringSettings } from "../../shared/types/mastering";

export type MasteringPresetId =
  | "none"
  | "transparent"
  | "warm-tape"
  | "crystal-air"
  | "punch-glue"
  | "wide-cinema"
  | "loud-clear"
  | "custom";

export interface MasteringPresetOption {
  value: MasteringPresetId;
  label: string;
}

export type FixedPresetId = Exclude<MasteringPresetId, "custom">;

export const MASTERING_PRESET_OPTIONS: MasteringPresetOption[] = [
  { value: "none", label: "None" },
  { value: "transparent", label: "Transparent" },
  { value: "warm-tape", label: "Warm Tape" },
  { value: "crystal-air", label: "Crystal Air" },
  { value: "punch-glue", label: "Punch Glue" },
  { value: "wide-cinema", label: "Wide Cinema" },
  { value: "loud-clear", label: "Loud & Clear" },
  { value: "custom", label: "Custom (Reset)" }
];

export const DEFAULT_PRESET_ID: FixedPresetId = "transparent";

export const PRESET_SETTINGS: Record<FixedPresetId, MasteringSettings> = {
  none: {
    targetLufs: -14,
    truePeakCeiling: -1,
    outputTrimDb: 0,
    normalizeLoudness: true,
    warmth: 0,
    clarity: 0,
    air: 0,
    lowEndClean: 0,
    stereoWidth: 100,
    spaceDepth: 0,
    monoBassAnchor: false,
    glueCompression: 0,
    autoLevelStrength: 0,
    sampleRate: 48000,
    bitDepth: 24,
    ditherMode: "none",
    outputFormat: "wav",
    mp3Bitrate: 192
  },
  transparent: {
    targetLufs: -14,
    truePeakCeiling: -1,
    outputTrimDb: 0,
    normalizeLoudness: true,
    warmth: 24,
    clarity: 34,
    air: 14,
    lowEndClean: 20,
    stereoWidth: 105,
    spaceDepth: 12,
    monoBassAnchor: true,
    glueCompression: 12,
    autoLevelStrength: 12,
    sampleRate: 48000,
    bitDepth: 24,
    ditherMode: "none",
    outputFormat: "wav",
    mp3Bitrate: 192
  },
  "warm-tape": {
    targetLufs: -14,
    truePeakCeiling: -1,
    outputTrimDb: 0,
    normalizeLoudness: true,
    warmth: 62,
    clarity: 10,
    air: 4,
    lowEndClean: 18,
    stereoWidth: 98,
    spaceDepth: 28,
    monoBassAnchor: true,
    glueCompression: 28,
    autoLevelStrength: 14,
    sampleRate: 48000,
    bitDepth: 24,
    ditherMode: "none",
    outputFormat: "wav",
    mp3Bitrate: 192
  },
  "crystal-air": {
    targetLufs: -14,
    truePeakCeiling: -1,
    outputTrimDb: 0,
    normalizeLoudness: true,
    warmth: 4,
    clarity: 55,
    air: 65,
    lowEndClean: 24,
    stereoWidth: 115,
    spaceDepth: 26,
    monoBassAnchor: true,
    glueCompression: 4,
    autoLevelStrength: 10,
    sampleRate: 48000,
    bitDepth: 24,
    ditherMode: "none",
    outputFormat: "wav",
    mp3Bitrate: 192
  },
  "punch-glue": {
    targetLufs: -12,
    truePeakCeiling: -0.5,
    outputTrimDb: 0,
    normalizeLoudness: true,
    warmth: 24,
    clarity: 28,
    air: 8,
    lowEndClean: 42,
    stereoWidth: 100,
    spaceDepth: 10,
    monoBassAnchor: true,
    glueCompression: 54,
    autoLevelStrength: 58,
    sampleRate: 48000,
    bitDepth: 24,
    ditherMode: "none",
    outputFormat: "wav",
    mp3Bitrate: 192
  },
  "wide-cinema": {
    targetLufs: -16,
    truePeakCeiling: -1.5,
    outputTrimDb: 0,
    normalizeLoudness: true,
    warmth: 12,
    clarity: 18,
    air: 38,
    lowEndClean: 12,
    stereoWidth: 124,
    spaceDepth: 54,
    monoBassAnchor: false,
    glueCompression: 6,
    autoLevelStrength: 10,
    sampleRate: 48000,
    bitDepth: 24,
    ditherMode: "none",
    outputFormat: "wav",
    mp3Bitrate: 192
  },
  "loud-clear": {
    targetLufs: -11,
    truePeakCeiling: -0.3,
    outputTrimDb: 0,
    normalizeLoudness: true,
    warmth: 8,
    clarity: 42,
    air: 24,
    lowEndClean: 36,
    stereoWidth: 105,
    spaceDepth: 14,
    monoBassAnchor: true,
    glueCompression: 24,
    autoLevelStrength: 28,
    sampleRate: 48000,
    bitDepth: 24,
    ditherMode: "none",
    outputFormat: "wav",
    mp3Bitrate: 192
  }
};

export function getPresetSettings(presetId: FixedPresetId): MasteringSettings {
  return { ...PRESET_SETTINGS[presetId], presetId };
}
