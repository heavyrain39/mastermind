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
    clarity: 38,
    air: 20,
    lowEndClean: 30,
    stereoWidth: 105,
    spaceDepth: 12,
    monoBassAnchor: true,
    glueCompression: 15,
    autoLevelStrength: 18,
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
    clarity: 18,
    air: 8,
    lowEndClean: 15,
    stereoWidth: 98,
    spaceDepth: 28,
    monoBassAnchor: true,
    glueCompression: 40,
    autoLevelStrength: 22,
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
    warmth: 10,
    clarity: 55,
    air: 65,
    lowEndClean: 40,
    stereoWidth: 115,
    spaceDepth: 22,
    monoBassAnchor: true,
    glueCompression: 8,
    autoLevelStrength: 12,
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
    warmth: 30,
    clarity: 42,
    air: 15,
    lowEndClean: 55,
    stereoWidth: 100,
    spaceDepth: 8,
    monoBassAnchor: true,
    glueCompression: 65,
    autoLevelStrength: 50,
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
    warmth: 20,
    clarity: 30,
    air: 45,
    lowEndClean: 25,
    stereoWidth: 135,
    spaceDepth: 70,
    monoBassAnchor: false,
    glueCompression: 12,
    autoLevelStrength: 15,
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
    warmth: 15,
    clarity: 50,
    air: 35,
    lowEndClean: 50,
    stereoWidth: 105,
    spaceDepth: 10,
    monoBassAnchor: true,
    glueCompression: 35,
    autoLevelStrength: 40,
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
