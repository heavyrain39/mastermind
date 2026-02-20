import type { MasteringSettings } from "../../shared/types/mastering";

export type MasteringPresetId =
  | "transparent"
  | "velvet-lift"
  | "crystal-air"
  | "punch-glue"
  | "wide-cinema"
  | "broadcast-calm"
  | "custom";

export interface MasteringPresetOption {
  value: MasteringPresetId;
  label: string;
}

export type FixedPresetId = Exclude<MasteringPresetId, "custom">;

const BASE_PRESET_SETTINGS: MasteringSettings = {
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
  ditherMode: "none"
};

export const MASTERING_PRESET_OPTIONS: MasteringPresetOption[] = [
  { value: "transparent", label: "Transparent" },
  { value: "velvet-lift", label: "Velvet Lift" },
  { value: "crystal-air", label: "Crystal Air" },
  { value: "punch-glue", label: "Punch Glue" },
  { value: "wide-cinema", label: "Wide Cinema" },
  { value: "broadcast-calm", label: "Broadcast Calm" },
  { value: "custom", label: "Custom (Reset)" }
];

export const DEFAULT_PRESET_ID: FixedPresetId = "transparent";

export const PRESET_SETTINGS: Record<FixedPresetId, MasteringSettings> = {
  transparent: { ...BASE_PRESET_SETTINGS },
  "velvet-lift": { ...BASE_PRESET_SETTINGS },
  "crystal-air": { ...BASE_PRESET_SETTINGS },
  "punch-glue": { ...BASE_PRESET_SETTINGS },
  "wide-cinema": { ...BASE_PRESET_SETTINGS },
  "broadcast-calm": { ...BASE_PRESET_SETTINGS }
};

export function getPresetSettings(presetId: FixedPresetId): MasteringSettings {
  return { ...PRESET_SETTINGS[presetId] };
}
