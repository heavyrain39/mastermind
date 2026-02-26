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
import { useEffect, useRef, useState } from "react";
import { motion, useSpring, useTransform, useMotionValueEvent } from "framer-motion";

const TAKT_EXTENSION_URL =
  "https://chromewebstore.google.com/detail/takt/kfgbaeikmjkommheilhphiageempppph";
const MSTRMND_EXTENSION_URL =
  "https://chromewebstore.google.com/detail/mastermind/amifcacblgkkccoejchknikodagjhopk";
const MSTRMND_REVIEWS_URL = `${MSTRMND_EXTENSION_URL}/reviews`;
const MSTRMND_WEB_ORIGIN = "https://mstr-mnd.vercel.app";

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

const formatOptions = [
  { value: "wav", label: "WAV" },
  { value: "mp3", label: "MP3" }
];

const mp3BitrateOptions = [
  { value: "128", label: "128 kbps" },
  { value: "192", label: "192 kbps" },
  { value: "256", label: "256 kbps" },
  { value: "320", label: "320 kbps" }
];

interface MasteringPanelProps {
  locale: UiLocale;
}

export function MasteringPanel({ locale }: MasteringPanelProps) {
  const { masteringSettings, updateMasteringSettings, selectedPresetId, setMasteringPreset } = useQueue();
  const tips = getUiTips(locale);
  const [showTaktPromo] = useState(() => Math.random() < 0.5);
  const isExtensionRuntime = window.location.protocol === "chrome-extension:";
  const isHostedWebApp = window.location.origin === MSTRMND_WEB_ORIGIN;

  const promoContent = (() => {
    if (showTaktPromo || (!isExtensionRuntime && !isHostedWebApp)) {
      return (
        <>
          Need focus? Try{" "}
          <a
            className="inline-link"
            href={TAKT_EXTENSION_URL}
            target="_blank"
            rel="noreferrer noopener"
          >
            TAKT
          </a>
        </>
      );
    }

    if (isHostedWebApp) {
      return (
        <a
          className="inline-link"
          href={MSTRMND_EXTENSION_URL}
          target="_blank"
          rel="noreferrer noopener"
        >
          Get Chrome Extension
        </a>
      );
    }

    return (
      <a
        className="inline-link"
        href={MSTRMND_REVIEWS_URL}
        target="_blank"
        rel="noreferrer noopener"
      >
        Leave a review
      </a>
    );
  })();

  return (
    <section className="panel mastering-panel">
      <div className="panel-head mastering-head">
        <h2>Mastering Controls</h2>
        <div className="preset-field">
          <Dropdown
            ariaLabel="Mastering preset"
            value={selectedPresetId}
            options={MASTERING_PRESET_OPTIONS}
            onChange={(next) => setMasteringPreset(next as MasteringPresetId)}
            tooltips={tips.presets}
          />
        </div>
      </div>

      <ScrollArea className="mastering-scroll">
        <section className="control-group">
          <h3>Loudness and Safety</h3>
          <RangeRow
            label="Target LUFS"
            value={masteringSettings.targetLufs}
            formatDisplay={(v) => `${v.toFixed(1)}`}
            min={-20}
            max={-8}
            step={0.1}
            tooltip={tips.mastering.targetLufs}
            onChange={(value) => updateMasteringSettings({ targetLufs: value })}
          />
          <RangeRow
            label="True Peak Ceiling"
            value={masteringSettings.truePeakCeiling}
            formatDisplay={(v) => `${v.toFixed(1)} dBTP`}
            min={-2}
            max={-0.1}
            step={0.1}
            tooltip={tips.mastering.truePeakCeiling}
            onChange={(value) => updateMasteringSettings({ truePeakCeiling: value })}
          />
          <RangeRow
            label="Output Trim"
            value={masteringSettings.outputTrimDb}
            formatDisplay={(v) => `${v.toFixed(1)} dB`}
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
            formatDisplay={(v) => `${Math.round(v)}%`}
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
              label="Format"
              value={masteringSettings.outputFormat}
              options={formatOptions}
              onChange={(next) => updateMasteringSettings({ outputFormat: next as "wav" | "mp3" })}
            />
            <InlineDropdown
              label="Sample Rate"
              value={String(masteringSettings.sampleRate)}
              options={sampleRateOptions}
              onChange={(next) =>
                updateMasteringSettings({ sampleRate: next === "44100" ? 44100 : 48000 })
              }
              tooltip={tips.mastering.sampleRate}
              tooltipPosition="left"
            />
            {masteringSettings.outputFormat === "mp3" ? (
              <InlineDropdown
                label="Bitrate"
                value={String(masteringSettings.mp3Bitrate)}
                options={mp3BitrateOptions}
                onChange={(next) =>
                  updateMasteringSettings({ mp3Bitrate: Number(next) as any })
                }
                tooltipPosition="left"
              />
            ) : (
              <InlineDropdown
                label="Bit Depth"
                value={String(masteringSettings.bitDepth)}
                options={bitDepthOptions}
                onChange={(next) => updateMasteringSettings({ bitDepth: next === "16" ? 16 : 24 })}
                tooltip={tips.mastering.bitDepth}
                tooltipPosition="left"
              />
            )}
            <InlineDropdown
              label="Dither"
              value={masteringSettings.ditherMode}
              options={ditherOptions}
              onChange={(next) => updateMasteringSettings({ ditherMode: next as DitherMode })}
              tooltip={tips.mastering.dither}
              tooltipPosition="left"
            />
          </div>
        </section>
      </ScrollArea>
      <footer className="app-credit">
        <div className="promo-links">{promoContent}</div>
        <div className="author-credit">
          Made by.{" "}
          <a
            className="inline-link"
            href="https://heavyrain39.github.io/portfolio/"
            target="_blank"
            rel="noreferrer noopener"
          >
            Yakshawan
          </a>
        </div>
      </footer>
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
      formatDisplay={(v) => `${Math.round(v)}%`}
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
  formatDisplay,
  min,
  max,
  step,
  tooltip,
  onChange
}: {
  label: string;
  value: number;
  formatDisplay: (v: number) => string;
  min: number;
  max: number;
  step: number;
  tooltip: string;
  onChange: (next: number) => void;
}) {
  const springValue = useSpring(value, { stiffness: 1100, damping: 65 });
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!isDragging) {
      springValue.set(value);
    }
  }, [value, springValue, isDragging]);

  useMotionValueEvent(springValue, "change", (latest) => {
    if (inputRef.current) {
      inputRef.current.value = String(latest);
    }
  });

  const progress = useTransform(springValue, (latest) =>
    `${Math.max(0, Math.min(100, ((latest - min) / (max - min)) * 100))}%`
  );

  const displayMotion = useTransform(springValue, (latest) => formatDisplay(latest));

  return (
    <label className="control-row compact has-tooltip" data-tooltip={tooltip}>
      <span className="control-label">{label}</span>
      <div className="control-main">
        <motion.input
          ref={inputRef}
          type="range"
          min={min}
          max={max}
          step={step}
          defaultValue={value}
          style={{ "--progress": progress as any } as any}
          onMouseDown={() => setIsDragging(true)}
          onTouchStart={() => setIsDragging(true)}
          onMouseUp={() => setIsDragging(false)}
          onTouchEnd={() => setIsDragging(false)}
          onChange={(event) => {
            const nextValue = Number(event.currentTarget.value);
            if (isDragging) {
              springValue.jump(nextValue);
            }
            onChange(nextValue);
          }}
        />
        <motion.strong>{displayMotion}</motion.strong>
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
  tooltip,
  tooltipPosition
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (next: string) => void;
  tooltip?: string;
  tooltipPosition?: "bottom" | "left";
}) {
  const className = `inline-field compact${tooltip ? " has-tooltip" : ""}`;
  return (
    <div
      className={className}
      data-tooltip={tooltip}
      data-tooltip-position={tooltipPosition}
    >
      <span>{label}</span>
      <Dropdown ariaLabel={label} value={value} options={options} onChange={onChange} />
    </div>
  );
}
