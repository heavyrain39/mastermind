import {
  MouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { FiDownload, FiPause, FiPlay, FiSquare } from "react-icons/fi";
import { ScrollArea } from "../../shared/ui/ScrollArea";
import { useQueue } from "../queue/QueueProvider";
import type { UiLocale } from "../../shared/i18n/useUiLocale";
import { getUiTips } from "../../shared/i18n/uiTips";

interface ABPlayerPanelProps {
  locale: UiLocale;
}

type PlaybackMode = "A" | "B";

const WAVE_BINS = 360;

export function ABPlayerPanel({ locale }: ABPlayerPanelProps) {
  const { tracks, activeTrack, activeTrackId, setActiveTrackId, downloadTrack, downloadDoneTracksZip } = useQueue();
  const [playingMode, setPlayingMode] = useState<PlaybackMode | null>(null);
  const [currentTimeA, setCurrentTimeA] = useState(0);
  const [currentTimeB, setCurrentTimeB] = useState(0);
  const [durationA, setDurationA] = useState(0);
  const [durationB, setDurationB] = useState(0);
  const [wavePeaksA, setWavePeaksA] = useState<number[] | null>(null);
  const [wavePeaksB, setWavePeaksB] = useState<number[] | null>(null);
  const tips = getUiTips(locale);
  const audioOriginalRef = useRef<HTMLAudioElement>(null);
  const audioMasteredRef = useRef<HTMLAudioElement>(null);
  const decodeContextRef = useRef<AudioContext | null>(null);

  const trackLabel = activeTrack ? activeTrack.fileName : "No track selected";
  const originalSrc = activeTrack?.originalUrl ?? "";
  const masteredSrc = activeTrack?.masteredUrl ?? "";
  const hasOriginal = Boolean(originalSrc);
  const hasMastered = Boolean(masteredSrc);

  const abReadyTracks = useMemo(() => tracks.filter((track) => track.status === "done"), [tracks]);

  useEffect(() => {
    const originalAudio = audioOriginalRef.current;
    const masteredAudio = audioMasteredRef.current;
    if (!originalAudio || !masteredAudio) return;

    originalAudio.src = originalSrc;
    originalAudio.load();

    masteredAudio.src = masteredSrc;
    masteredAudio.load();

    setCurrentTimeA(0);
    setCurrentTimeB(0);
    setDurationA(0);
    setDurationB(0);
    setPlayingMode(null);
  }, [originalSrc, masteredSrc]);

  useEffect(() => {
    let cancelled = false;
    setWavePeaksA(null);
    setWavePeaksB(null);

    const decodeContext = getDecodeContext(decodeContextRef);

    const loadWave = async (src: string) => {
      if (!src) return null;
      try {
        const response = await fetch(src);
        const sourceBytes = await response.arrayBuffer();
        const decoded = await decodeContext.decodeAudioData(sourceBytes.slice(0));
        return extractWavePeaks(decoded, WAVE_BINS);
      } catch {
        return null;
      }
    };

    void Promise.all([loadWave(originalSrc), loadWave(masteredSrc)]).then(([originalPeaks, masteredPeaks]) => {
      if (cancelled) return;
      setWavePeaksA(originalPeaks);
      setWavePeaksB(masteredPeaks);
    });

    return () => {
      cancelled = true;
    };
  }, [originalSrc, masteredSrc]);

  useEffect(() => {
    return () => {
      if (decodeContextRef.current && decodeContextRef.current.state !== "closed") {
        void decodeContextRef.current.close();
      }
    };
  }, []);

  const togglePlay = async (mode: PlaybackMode) => {
    const target = mode === "A" ? audioOriginalRef.current : audioMasteredRef.current;
    const other = mode === "A" ? audioMasteredRef.current : audioOriginalRef.current;
    if (!target) return;
    if (mode === "A" && !hasOriginal) return;
    if (mode === "B" && !hasMastered) return;

    if (playingMode === mode && !target.paused) {
      target.pause();
      setPlayingMode(null);
      return;
    }

    if (other && !other.paused) {
      other.pause();
    }

    try {
      await target.play();
      setPlayingMode(mode);
    } catch {
      setPlayingMode(null);
    }
  };

  const stopMode = (mode: PlaybackMode) => {
    const target = mode === "A" ? audioOriginalRef.current : audioMasteredRef.current;
    if (!target) return;
    target.pause();
    target.currentTime = 0;
    if (mode === "A") {
      setCurrentTimeA(0);
    } else {
      setCurrentTimeB(0);
    }
    if (playingMode === mode) {
      setPlayingMode(null);
    }
  };

  const seekAndPlayMode = async (mode: PlaybackMode, nextTime: number) => {
    const target = mode === "A" ? audioOriginalRef.current : audioMasteredRef.current;
    const other = mode === "A" ? audioMasteredRef.current : audioOriginalRef.current;
    const hasAudio = mode === "A" ? hasOriginal : hasMastered;
    if (!target || !hasAudio) return;

    if (other && !other.paused) {
      other.pause();
    }

    target.currentTime = nextTime;
    if (mode === "A") {
      setCurrentTimeA(nextTime);
    } else {
      setCurrentTimeB(nextTime);
    }

    try {
      await target.play();
      setPlayingMode(mode);
    } catch {
      setPlayingMode(null);
    }
  };

  const onWaveClick = (event: MouseEvent<HTMLDivElement>, mode: PlaybackMode) => {
    const audio = mode === "A" ? audioOriginalRef.current : audioMasteredRef.current;
    const duration = mode === "A" ? durationA : durationB;
    if (!audio || !duration) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const nextTime = ratio * duration;
    void seekAndPlayMode(mode, nextTime);
  };

  return (
    <section className="panel player-panel">
      <div className="panel-head">
        <h2>A/B Monitor</h2>
        <span className="meta-chip">Selected: {trackLabel}</span>
      </div>

      <div className="wave-stack">
        <WaveBlock
          label="Original"
          lufs={activeTrack?.originalLufs}
          isPlaying={playingMode === "A"}
          hasAudio={hasOriginal}
          currentTime={currentTimeA}
          duration={durationA}
          peaks={wavePeaksA}
          tooltipSeek={tips.ab.waveSeekOriginal}
          onTogglePlay={() => void togglePlay("A")}
          onStop={() => stopMode("A")}
          onSeek={(event) => onWaveClick(event, "A")}
        />
        <WaveBlock
          label="Mastered"
          lufs={activeTrack?.masteredLufs}
          isPlaying={playingMode === "B"}
          hasAudio={hasMastered}
          currentTime={currentTimeB}
          duration={durationB}
          peaks={wavePeaksB}
          tooltipSeek={tips.ab.waveSeekMastered}
          onTogglePlay={() => void togglePlay("B")}
          onStop={() => stopMode("B")}
          onSeek={(event) => onWaveClick(event, "B")}
        />
      </div>

      <div className="panel-subhead with-action">
        <h3>All-track A/B Ready List</h3>
        <button
          type="button"
          className="compact-btn has-tooltip"
          data-tooltip={tips.queue.downloadDoneTracks}
          onClick={() => void downloadDoneTracksZip()}
          disabled={abReadyTracks.length === 0}
        >
          Download All
        </button>
      </div>

      <ScrollArea className="ab-list-scroll">
        <ul className="ab-track-list">
          {abReadyTracks.map((track) => (
            <li
              key={track.id}
              className={`ab-track-row ${track.id === activeTrackId ? "is-selected" : ""}`}
              onClick={() => setActiveTrackId(track.id)}
            >
              <span>{track.fileName}</span>
              <button
                type="button"
                className="icon-btn has-tooltip"
                data-tooltip={tips.queue.downloadTrack}
                aria-label={`Download ${track.fileName}`}
                onClick={(event) => {
                  event.stopPropagation();
                  downloadTrack(track.id);
                }}
              >
                <FiDownload aria-hidden />
              </button>
            </li>
          ))}
          {abReadyTracks.length === 0 ? (
            <li className="track-empty">A/B ready tracks appear after mastering.</li>
          ) : null}
        </ul>
      </ScrollArea>

      <audio
        ref={audioOriginalRef}
        onLoadedMetadata={(event) => setDurationA(event.currentTarget.duration || 0)}
        onTimeUpdate={(event) => setCurrentTimeA(event.currentTarget.currentTime)}
        onPlay={() => setPlayingMode("A")}
        onPause={() => setPlayingMode((prev) => (prev === "A" ? null : prev))}
        onEnded={() => setPlayingMode((prev) => (prev === "A" ? null : prev))}
      />
      <audio
        ref={audioMasteredRef}
        onLoadedMetadata={(event) => setDurationB(event.currentTarget.duration || 0)}
        onTimeUpdate={(event) => setCurrentTimeB(event.currentTarget.currentTime)}
        onPlay={() => setPlayingMode("B")}
        onPause={() => setPlayingMode((prev) => (prev === "B" ? null : prev))}
        onEnded={() => setPlayingMode((prev) => (prev === "B" ? null : prev))}
      />
    </section>
  );
}

function WaveBlock({
  label,
  lufs,
  isPlaying,
  hasAudio,
  currentTime,
  duration,
  peaks,
  tooltipSeek,
  onTogglePlay,
  onStop,
  onSeek
}: {
  label: string;
  lufs?: number;
  isPlaying: boolean;
  hasAudio: boolean;
  currentTime: number;
  duration: number;
  peaks: number[] | null;
  tooltipSeek: string;
  onTogglePlay: () => void;
  onStop: () => void;
  onSeek: (event: MouseEvent<HTMLDivElement>) => void;
}) {
  const progress = duration > 0 ? Math.max(0, Math.min(1, currentTime / duration)) : 0;
  return (
    <div className="wave-block">
      <header>
        <div className="wave-label-wrap">
          <strong>{label}</strong>
          <span>{formatLufs(lufs)}</span>
        </div>
        <span className="time-readout">
          {formatClock(currentTime)} / {formatClock(duration)}
        </span>
      </header>
      <div className="wave-row">
        <div className="wave-controls">
          <button type="button" onClick={onTogglePlay} disabled={!hasAudio}>
            {isPlaying ? <FiPause aria-hidden /> : <FiPlay aria-hidden />}
            <span>{isPlaying ? "Pause" : "Play"}</span>
          </button>
          <button type="button" onClick={onStop} disabled={!hasAudio}>
            <FiSquare aria-hidden />
            <span>Stop</span>
          </button>
        </div>
        <div
          className="wave-canvas has-tooltip"
          role="button"
          tabIndex={0}
          data-tooltip={tooltipSeek}
          onClick={onSeek}
        >
          <WaveformCanvas peaks={peaks} progress={progress} placeholder={!hasAudio ? "No mastered file yet" : ""} />
        </div>
      </div>
    </div>
  );
}

function WaveformCanvas({
  peaks,
  progress,
  placeholder
}: {
  peaks: number[] | null;
  progress: number;
  placeholder?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "rgba(120, 129, 141, 0.12)";
      ctx.fillRect(0, 0, width, height);

      if (!peaks || peaks.length === 0) {
        ctx.fillStyle = "rgba(120, 129, 141, 0.75)";
        ctx.font = '12px "Sora", sans-serif';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(placeholder || "Waveform loading...", width / 2, height / 2);
      } else {
        const mid = height / 2;
        const step = width / peaks.length;
        ctx.strokeStyle = "rgba(56, 69, 86, 0.92)";
        ctx.lineWidth = Math.max(1, step * 0.8);
        ctx.beginPath();
        for (let i = 0; i < peaks.length; i += 1) {
          const x = i * step + step / 2;
          const amp = peaks[i] * (height * 0.45);
          ctx.moveTo(x, mid - amp);
          ctx.lineTo(x, mid + amp);
        }
        ctx.stroke();
      }

      const playX = Math.max(0, Math.min(width, width * progress));
      ctx.fillStyle = "rgba(12, 16, 20, 0.28)";
      ctx.fillRect(0, 0, playX, height);
      ctx.fillStyle = "rgba(12, 16, 20, 0.65)";
      ctx.fillRect(playX - 1, 0, 2, height);
    };

    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [peaks, progress, placeholder]);

  return <canvas ref={canvasRef} />;
}

function extractWavePeaks(buffer: AudioBuffer, bins: number) {
  if (buffer.length === 0 || bins <= 0) return [];

  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) =>
    buffer.getChannelData(index)
  );
  const points = new Array<number>(bins).fill(0);
  const samplesPerBin = Math.max(1, Math.floor(buffer.length / bins));

  for (let bin = 0; bin < bins; bin += 1) {
    const start = bin * samplesPerBin;
    const end = Math.min(buffer.length, start + samplesPerBin);
    let peak = 0;

    for (let i = start; i < end; i += 1) {
      let sum = 0;
      for (let ch = 0; ch < channels.length; ch += 1) {
        sum += Math.abs(channels[ch][i] || 0);
      }
      const average = sum / channels.length;
      if (average > peak) peak = average;
    }

    points[bin] = peak;
  }

  const maxPeak = Math.max(...points, 0.0001);
  return points.map((point) => Math.max(0.02, point / maxPeak));
}

function getDecodeContext(contextRef: { current: AudioContext | null }) {
  if (!contextRef.current) {
    contextRef.current = new AudioContext();
  }
  return contextRef.current;
}

function formatLufs(value?: number): string {
  return typeof value === "number" ? `${value.toFixed(1)} LUFS` : "--";
}

function formatClock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "00:00";
  const whole = Math.floor(seconds);
  const min = Math.floor(whole / 60);
  const sec = whole % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
