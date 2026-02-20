import { useQueue } from "../queue/QueueProvider";
import { Dropdown } from "../../shared/ui/Dropdown";
import { ScrollArea } from "../../shared/ui/ScrollArea";
import type { UiLocale } from "../../shared/i18n/useUiLocale";
import { getUiTips } from "../../shared/i18n/uiTips";
import type { DitherMode } from "../../shared/types/mastering";
import {
  MASTERING_PRESET_OPTIONS,
  type MasteringPresetId
} from "./presets";

const sampleRateOptions = [
  { value: "48000", label: "48 kHz" },
  { value: "44100", label: "44.1 kHz" }
];

const bitDepthOptions = [
  { value: "24", label: "24-bit" },
  { value: "16", label: "16-bit" }
];

const ditherOptions: Array<{ value: DitherMode; label: string }> = [
  { value: "none", label: "None" },
  { value: "tpdf", label: "TPDF" },
  { value: "noise-shaped", label: "Noise-shaped" }
];

interface MasteringPanelProps {
  locale: UiLocale;
}

export function MasteringPanel({ locale }: MasteringPanelProps) {
  const { masteringSettings, updateMasteringSettings, selectedPresetId, setMasteringPreset } = useQueue();
  const tips = getUiTips(locale);

  return (
    <section className="panel mastering-panel">
      <div className="panel-head mastering-head">
        <h2>Mastering Controls</h2>
        <div className="preset-field">
          <span>Preset</span>
          <Dropdown
            ariaLabel="Mastering preset"
            value={selectedPresetId}
            options={MASTERING_PRESET_OPTIONS}
            onChange={(next) => setMasteringPreset(next as MasteringPresetId)}
          />
        </div>
      </div>

      <ScrollArea className="mastering-scroll">
        <section className="control-group">
          <h3>Loudness and Safety</h3>
          <RangeRow
            label="Target LUFS"
            value={masteringSettings.targetLufs}
            display={`${masteringSettings.targetLufs.toFixed(1)}`}
            min={-20}
            max={-8}
            step={0.1}
            tooltip={tips.mastering.targetLufs}
            onChange={(value) => updateMasteringSettings({ targetLufs: value })}
          />
          <RangeRow
            label="True Peak Ceiling"
            value={masteringSettings.truePeakCeiling}
            display={`${masteringSettings.truePeakCeiling.toFixed(1)} dBTP`}
            min={-2}
            max={-0.1}
            step={0.1}
            tooltip={tips.mastering.truePeakCeiling}
            onChange={(value) => updateMasteringSettings({ truePeakCeiling: value })}
          />
          <RangeRow
            label="Output Trim"
            value={masteringSettings.outputTrimDb}
            display={`${masteringSettings.outputTrimDb.toFixed(1)} dB`}
            min={-6}
            max={6}
            step={0.1}
            tooltip={tips.mastering.outputTrim}
            onChange={(value) => updateMasteringSettings({ outputTrimDb: value })}
          />
          <ToggleRow
            label="Normalize Loudness"
            checked={masteringSettings.normalizeLoudness}
            tooltip={tips.mastering.normalizeLoudness}
            onChange={(checked) => updateMasteringSettings({ normalizeLoudness: checked })}
          />
        </section>

        <section className="control-group">
          <h3>Tone Character</h3>
          <PercentRow
            label="Warmth"
            value={masteringSettings.warmth}
            tooltip={tips.mastering.warmth}
            onChange={(value) => updateMasteringSettings({ warmth: value })}
          />
          <PercentRow
            label="Clarity (De-harsh)"
            value={masteringSettings.clarity}
            tooltip={tips.mastering.clarity}
            onChange={(value) => updateMasteringSettings({ clarity: value })}
          />
          <PercentRow
            label="Air"
            value={masteringSettings.air}
            tooltip={tips.mastering.air}
            onChange={(value) => updateMasteringSettings({ air: value })}
          />
          <PercentRow
            label="Low-end Clean"
            value={masteringSettings.lowEndClean}
            tooltip={tips.mastering.lowEndClean}
            onChange={(value) => updateMasteringSettings({ lowEndClean: value })}
          />
        </section>

        <section className="control-group">
          <h3>Stereo and Space</h3>
          <RangeRow
            label="Stereo Width"
            value={masteringSettings.stereoWidth}
            display={`${Math.round(masteringSettings.stereoWidth)}%`}
            min={80}
            max={140}
            step={1}
            tooltip={tips.mastering.stereoWidth}
            onChange={(value) => updateMasteringSettings({ stereoWidth: Math.round(value) })}
          />
          <PercentRow
            label="Space Depth"
            value={masteringSettings.spaceDepth}
            tooltip={tips.mastering.spaceDepth}
            onChange={(value) => updateMasteringSettings({ spaceDepth: value })}
          />
          <ToggleRow
            label="Mono Bass Anchor"
            checked={masteringSettings.monoBassAnchor}
            tooltip={tips.mastering.monoBassAnchor}
            onChange={(checked) => updateMasteringSettings({ monoBassAnchor: checked })}
          />
        </section>

        <section className="control-group">
          <h3>Dynamics</h3>
          <PercentRow
            label="Glue Compression"
            value={masteringSettings.glueCompression}
            tooltip={tips.mastering.glueCompression}
            onChange={(value) => updateMasteringSettings({ glueCompression: value })}
          />
          <PercentRow
            label="Auto-level Strength"
            value={masteringSettings.autoLevelStrength}
            tooltip={tips.mastering.autoLevelStrength}
            onChange={(value) => updateMasteringSettings({ autoLevelStrength: value })}
          />
        </section>

        <section className="control-group low-priority">
          <h3>Output Format</h3>
          <div className="output-format-row">
            <InlineDropdown
              label="Sample Rate"
              value={String(masteringSettings.sampleRate)}
              options={sampleRateOptions}
              onChange={(next) =>
                updateMasteringSettings({ sampleRate: next === "44100" ? 44100 : 48000 })
              }
              tooltip={tips.mastering.sampleRate}
            />
            <InlineDropdown
              label="Bit Depth"
              value={String(masteringSettings.bitDepth)}
              options={bitDepthOptions}
              onChange={(next) => updateMasteringSettings({ bitDepth: next === "16" ? 16 : 24 })}
              tooltip={tips.mastering.bitDepth}
            />
            <InlineDropdown
              label="Dither"
              value={masteringSettings.ditherMode}
              options={ditherOptions}
              onChange={(next) => updateMasteringSettings({ ditherMode: next as DitherMode })}
              tooltip={tips.mastering.dither}
            />
          </div>
        </section>
      </ScrollArea>
    </section>
  );
}

function PercentRow({
  label,
  value,
  tooltip,
  onChange
}: {
  label: string;
  value: number;
  tooltip: string;
  onChange: (next: number) => void;
}) {
  return (
    <RangeRow
      label={label}
      value={value}
      display={`${Math.round(value)}%`}
      min={0}
      max={100}
      step={1}
      tooltip={tooltip}
      onChange={(next) => onChange(Math.round(next))}
    />
  );
}

function RangeRow({
  label,
  value,
  display,
  min,
  max,
  step,
  tooltip,
  onChange
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  tooltip: string;
  onChange: (next: number) => void;
}) {
  return (
    <label className="control-row compact has-tooltip" data-tooltip={tooltip}>
      <span className="control-label">{label}</span>
      <div className="control-main">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.currentTarget.value))}
        />
        <strong>{display}</strong>
      </div>
    </label>
  );
}

function ToggleRow({
  label,
  checked,
  tooltip,
  onChange
}: {
  label: string;
  checked: boolean;
  tooltip: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="toggle-row compact has-tooltip" data-tooltip={tooltip}>
      <span className="control-label">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
    </label>
  );
}

function InlineDropdown({
  label,
  value,
  options,
  onChange,
  tooltip
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (next: string) => void;
  tooltip: string;
}) {
  return (
    <div className="inline-field compact has-tooltip" data-tooltip={tooltip}>
      <span>{label}</span>
      <Dropdown ariaLabel={label} value={value} options={options} onChange={onChange} />
    </div>
  );
}

