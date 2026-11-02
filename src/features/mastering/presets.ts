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
    autoBalance: 0,
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
    autoBalance: 100,
    warmth: 10,
    clarity: 30,
    air: 15,
    lowEndClean: 15,
    stereoWidth: 106,
    spaceDepth: 10,
    monoBassAnchor: true,
    glueCompression: 10,
    autoLevelStrength: 10,
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
    autoBalance: 0,
    warmth: 80,
    clarity: 25,
    air: 0,
    lowEndClean: 10,
    stereoWidth: 98,
    spaceDepth: 20,
    monoBassAnchor: true,
    glueCompression: 35,
    autoLevelStrength: 15,
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
    autoBalance: 0,
    warmth: 0,
    clarity: 45,
    air: 80,
    lowEndClean: 15,
    stereoWidth: 118,
    spaceDepth: 20,
    monoBassAnchor: true,
    glueCompression: 5,
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
    autoBalance: 0,
    warmth: 50,
    clarity: 25,
    air: 35,
    lowEndClean: 10,
    stereoWidth: 100,
    spaceDepth: 8,
    monoBassAnchor: true,
    glueCompression: 60,
    autoLevelStrength: 60,
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
    autoBalance: 0,
    warmth: 40,
    clarity: 15,
    air: 55,
    lowEndClean: 10,
    stereoWidth: 128,
    spaceDepth: 50,
    monoBassAnchor: false,
    glueCompression: 5,
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
    autoBalance: 0,
    warmth: 35,
    clarity: 45,
    air: 50,
    lowEndClean: 25,
    stereoWidth: 105,
    spaceDepth: 12,
    monoBassAnchor: true,
    glueCompression: 25,
    autoLevelStrength: 30,
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
