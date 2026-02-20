import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import JSZip from "jszip";
import { type TrackItem } from "../../shared/types/audio";
import { type MasteringSettings } from "../../shared/types/mastering";
import { audioBufferToWavBlob, resampleAudioBuffer } from "../../lib/audio/wav";
import { type DSPWorkerClient, type FullChainSettings, getDSPWorkerClient } from "../../lib/dsp/dspWorkerClient";
import {
  DEFAULT_PRESET_ID,
  type FixedPresetId,
  getPresetSettings,
  type MasteringPresetId
} from "../mastering/presets";

interface QueueContextValue {
  tracks: TrackItem[];
  activeTrackId: string | null;
  activeTrack: TrackItem | null;
  isProcessing: boolean;
  masteringSettings: MasteringSettings;
  selectedPresetId: MasteringPresetId;
  updateMasteringSettings: (patch: Partial<MasteringSettings>) => void;
  setMasteringPreset: (presetId: MasteringPresetId) => void;
  addFiles: (files: File[]) => void;
  clearQueue: () => void;
  removeTrack: (trackId: string) => void;
  setActiveTrackId: (trackId: string) => void;
  toggleTrackSelected: (trackId: string) => void;
  selectAllTracks: (selected: boolean) => void;
  processSelectedTracks: () => Promise<void>;
  downloadTrack: (trackId: string) => void;
  downloadDoneTracksZip: () => Promise<void>;
}

const QueueContext = createContext<QueueContextValue | null>(null);

const STORAGE_KEYS = {
  settings: "mastermind.mastering.settings.v1",
  preset: "mastermind.mastering.preset.v1"
} as const;

const DEFAULT_MASTERING_SETTINGS = getPresetSettings(DEFAULT_PRESET_ID);

const EQ_BASE = {
  eqLow: 0,
  eqLowMid: -1,
  eqMid: 0,
  eqHighMid: -0.5,
  eqHigh: 0.5
};

export function QueueProvider({ children }: { children: ReactNode }) {
  const [tracks, setTracks] = useState<TrackItem[]>([]);
  const [activeTrackId, setActiveTrackIdState] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [masteringSettings, setMasteringSettings] = useState<MasteringSettings>(() =>
    readSettingsFromStorage()
  );
  const [selectedPresetId, setSelectedPresetId] = useState<MasteringPresetId>(() =>
    readPresetFromStorage()
  );
  const sequenceRef = useRef(0);
  const tracksRef = useRef<TrackItem[]>([]);
  const settingsRef = useRef<MasteringSettings>(masteringSettings);
  const decodeContextRef = useRef<AudioContext | null>(null);
  const workerClientRef = useRef<DSPWorkerClient | null>(null);

  const activeTrack = useMemo(
    () => tracks.find((track) => track.id === activeTrackId) ?? null,
    [tracks, activeTrackId]
  );

  const setActiveTrackId = (trackId: string) => {
    setActiveTrackIdState(trackId);
  };

  const updateMasteringSettings = (patch: Partial<MasteringSettings>) => {
    setMasteringSettings((prev) => ({ ...prev, ...patch }));
    setSelectedPresetId("custom");
  };

  const setMasteringPreset = (presetId: MasteringPresetId) => {
    if (presetId === "custom") {
      setMasteringSettings(getPresetSettings(DEFAULT_PRESET_ID));
      setSelectedPresetId(DEFAULT_PRESET_ID);
      return;
    }

    const fixedPresetId = presetId as FixedPresetId;
    setMasteringSettings(getPresetSettings(fixedPresetId));
    setSelectedPresetId(fixedPresetId);
  };

  const addFiles = (files: File[]) => {
    const wavFiles = files.filter(isSupportedAudioFile);
    if (wavFiles.length === 0) return;

    const createdTracks = wavFiles.map((file) => createTrack(file, sequenceRef.current++));
    setTracks((prev) => [...prev, ...createdTracks]);
    setActiveTrackIdState((prev) => prev ?? createdTracks[0]?.id ?? null);
  };

  const clearQueue = () => {
    setTracks((prev) => {
      prev.forEach(revokeTrackUrls);
      return [];
    });
    setActiveTrackIdState(null);
  };

  const removeTrack = (trackId: string) => {
    setTracks((prev) => {
      const target = prev.find((track) => track.id === trackId);
      if (target) revokeTrackUrls(target);
      return prev.filter((track) => track.id !== trackId);
    });
    setActiveTrackIdState((prev) => (prev === trackId ? null : prev));
  };

  const toggleTrackSelected = (trackId: string) => {
    setTracks((prev) =>
      prev.map((track) => (track.id === trackId ? { ...track, selected: !track.selected } : track))
    );
  };

  const selectAllTracks = (selected: boolean) => {
    setTracks((prev) => prev.map((track) => ({ ...track, selected })));
  };

  const downloadTrack = (trackId: string) => {
    const target = tracksRef.current.find((track) => track.id === trackId);
    if (!target?.masteredUrl) return;
    triggerDownload(target.masteredUrl, target.masteredFileName ?? deriveMasteredFileName(target.fileName));
  };

  const downloadDoneTracksZip = async () => {
    const doneTracks = tracksRef.current.filter((track) => track.status === "done" && track.masteredUrl);
    if (doneTracks.length === 0) return;

    const zip = new JSZip();

    for (const track of doneTracks) {
      const fileName = track.masteredFileName ?? deriveMasteredFileName(track.fileName);
      const response = await fetch(track.masteredUrl!);
      const blob = await response.blob();
      zip.file(fileName, blob);
    }

    const zipBlob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 }
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const zipUrl = URL.createObjectURL(zipBlob);
    triggerDownload(zipUrl, `mastermind-mastered-${timestamp}.zip`);
    window.setTimeout(() => URL.revokeObjectURL(zipUrl), 2000);
  };

  const processTracks = async (trackIds: string[]) => {
    if (trackIds.length === 0 || isProcessing) return;
    setIsProcessing(true);

    const targets = trackIds.filter((trackId) => tracksRef.current.some((track) => track.id === trackId));

    setTracks((prev) =>
      prev.map((track) =>
        targets.includes(track.id)
          ? {
              ...track,
              status: "queued",
              errorMessage: undefined,
              progressPercent: 0,
              progressStatus: "Queued"
            }
          : track
      )
    );

    try {
      const workerClient = await getDSPWorkerClient();
      workerClientRef.current = workerClient;
      const decodeContext = getDecodeContext(decodeContextRef);
      const selectedSettings = settingsRef.current;
      const workerSettings = toWorkerSettings(selectedSettings);

      for (const trackId of targets) {
        const sourceTrack = tracksRef.current.find((track) => track.id === trackId);
        if (!sourceTrack) continue;

        setTracks((prev) =>
          prev.map((track) =>
            track.id === trackId
              ? {
                  ...track,
                  status: "processing",
                  errorMessage: undefined,
                  progressPercent: 0,
                  progressStatus: "Decoding audio"
                }
              : track
          )
        );

        try {
          const decodedBuffer = await decodeFileToAudioBuffer(sourceTrack.sourceFile, decodeContext);
          const originalBuffer = ensureStereoBuffer(decodedBuffer);

          setTracks((prev) =>
            prev.map((track) =>
              track.id === trackId
                ? { ...track, progressPercent: 5, progressStatus: "Measuring loudness" }
                : track
            )
          );

          const originalLufsResult = await workerClient.measureLufs(originalBuffer);
          let masteredBuffer: AudioBuffer;
          let masteredLufs: number | undefined;

          try {
            const mastered = await workerClient.renderFullChain(
              originalBuffer,
              workerSettings,
              "export",
              (progress, status) => {
                const percent = Math.max(6, Math.min(96, Math.round(progress * 90 + 6)));
                setTracks((prev) =>
                  prev.map((track) =>
                    track.id === trackId
                      ? {
                          ...track,
                          progressPercent: percent,
                          progressStatus: status || "Processing"
                        }
                      : track
                  )
                );
              }
            );
            masteredBuffer = mastered.audioBuffer;
            masteredLufs = mastered.lufs;
          } catch {
            setTracks((prev) =>
              prev.map((track) =>
                track.id === trackId
                  ? {
                      ...track,
                      progressPercent: 60,
                      progressStatus: "Fallback rendering (safe normalize)"
                    }
                  : track
              )
            );
            const normalized = await workerClient.normalize(
              originalBuffer,
              selectedSettings.targetLufs,
              selectedSettings.truePeakCeiling,
              (progress, status) => {
                const percent = Math.max(60, Math.min(96, Math.round(progress * 36 + 60)));
                setTracks((prev) =>
                  prev.map((track) =>
                    track.id === trackId
                      ? {
                          ...track,
                          progressPercent: percent,
                          progressStatus: status || "Normalizing"
                        }
                      : track
                  )
                );
              }
            );
            masteredBuffer = normalized.audioBuffer;
            masteredLufs = normalized.finalLUFS;
          }

          setTracks((prev) =>
            prev.map((track) =>
              track.id === trackId
                ? { ...track, progressPercent: 97, progressStatus: "Rendering output format" }
                : track
            )
          );

          const outputBuffer = await resampleAudioBuffer(masteredBuffer, selectedSettings.sampleRate);
          const masteredBlob = audioBufferToWavBlob(outputBuffer, {
            bitDepth: selectedSettings.bitDepth,
            ditherMode: selectedSettings.ditherMode
          });
          const nextMasteredUrl = URL.createObjectURL(masteredBlob);
          const nextFileName = deriveMasteredFileName(sourceTrack.fileName);

          let previousMasteredUrl: string | undefined;
          setTracks((prev) =>
            prev.map((track) => {
              if (track.id !== trackId) return track;
              previousMasteredUrl = track.masteredUrl;
              return {
                ...track,
                status: "done",
                originalLufs: toFiniteNumber(originalLufsResult.lufs),
                masteredLufs: toFiniteNumber(masteredLufs ?? originalLufsResult.lufs),
                masteredUrl: nextMasteredUrl,
                masteredFileName: nextFileName,
                masteredSizeBytes: masteredBlob.size,
                progressPercent: 100,
                progressStatus: "Complete",
                errorMessage: undefined
              };
            })
          );

          if (
            previousMasteredUrl &&
            previousMasteredUrl !== sourceTrack.originalUrl &&
            previousMasteredUrl !== nextMasteredUrl
          ) {
            URL.revokeObjectURL(previousMasteredUrl);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Mastering failed";
          setTracks((prev) =>
            prev.map((track) =>
              track.id === trackId
                ? {
                    ...track,
                    status: "error",
                    errorMessage: message,
                    progressStatus: message,
                    progressPercent: undefined
                  }
                : track
            )
          );
        }
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const processSelectedTracks = async () => {
    const ids = tracksRef.current.filter((track) => track.selected).map((track) => track.id);
    await processTracks(ids);
  };

  useEffect(() => {
    if (tracks.length === 0) return;
    if (activeTrackId && tracks.some((track) => track.id === activeTrackId)) return;
    setActiveTrackIdState(tracks[0].id);
  }, [tracks, activeTrackId]);

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  useEffect(() => {
    settingsRef.current = masteringSettings;
  }, [masteringSettings]);

  useEffect(() => {
    writeSettingsToStorage(masteringSettings);
  }, [masteringSettings]);

  useEffect(() => {
    writePresetToStorage(selectedPresetId);
  }, [selectedPresetId]);

  useEffect(() => {
    return () => {
      tracksRef.current.forEach(revokeTrackUrls);
      workerClientRef.current?.terminate();
      if (decodeContextRef.current && decodeContextRef.current.state !== "closed") {
        void decodeContextRef.current.close();
      }
    };
  }, []);

  const value: QueueContextValue = {
    tracks,
    activeTrackId,
    activeTrack,
    isProcessing,
    masteringSettings,
    selectedPresetId,
    updateMasteringSettings,
    setMasteringPreset,
    addFiles,
    clearQueue,
    removeTrack,
    setActiveTrackId,
    toggleTrackSelected,
    selectAllTracks,
    processSelectedTracks,
    downloadTrack,
    downloadDoneTracksZip
  };

  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>;
}

export function useQueue() {
  const context = useContext(QueueContext);
  if (!context) {
    throw new Error("useQueue must be used within QueueProvider");
  }
  return context;
}

function isSupportedAudioFile(file: File) {
  const lowerName = file.name.trim().toLowerCase();
  if (lowerName.endsWith(".wav") || lowerName.endsWith(".wave")) return true;
  if (file.type === "audio/wav" || file.type === "audio/x-wav" || file.type === "audio/wave") {
    return true;
  }
  return file.type.startsWith("audio/");
}

function createTrack(file: File, index: number): TrackItem {
  const originalUrl = URL.createObjectURL(file);
  return {
    id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    fileName: file.name,
    status: "idle",
    selected: true,
    sizeBytes: file.size,
    addedAt: Date.now(),
    sourceFile: file,
    originalUrl
  };
}

function deriveMasteredFileName(fileName: string) {
  return `${fileName.replace(/\.[^.]+$/, "")}_mastered.wav`;
}

function revokeTrackUrls(track: TrackItem) {
  URL.revokeObjectURL(track.originalUrl);
  if (track.masteredUrl && track.masteredUrl !== track.originalUrl) {
    URL.revokeObjectURL(track.masteredUrl);
  }
}

function triggerDownload(url: string, fileName: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

function getDecodeContext(contextRef: { current: AudioContext | null }) {
  if (!contextRef.current) {
    contextRef.current = new AudioContext();
  }
  return contextRef.current;
}

async function decodeFileToAudioBuffer(file: File, context: AudioContext) {
  const rawBuffer = await file.arrayBuffer();
  const decodeInput = rawBuffer.slice(0);
  return context.decodeAudioData(decodeInput);
}

function ensureStereoBuffer(buffer: AudioBuffer) {
  if (buffer.numberOfChannels >= 2) {
    return buffer;
  }

  const stereo = new AudioBuffer({
    numberOfChannels: 2,
    length: buffer.length,
    sampleRate: buffer.sampleRate
  });
  const mono = buffer.getChannelData(0);
  stereo.copyToChannel(mono, 0);
  stereo.copyToChannel(mono, 1);
  return stereo;
}

function toFiniteNumber(value: number) {
  if (!Number.isFinite(value)) {
    return undefined;
  }
  return value;
}

function toWorkerSettings(settings: MasteringSettings): FullChainSettings {
  return {
    inputGain: settings.outputTrimDb,
    normalizeLoudness: settings.normalizeLoudness,
    targetLufs: settings.targetLufs,
    truePeakLimit: true,
    truePeakCeiling: settings.truePeakCeiling,
    deharsh: settings.clarity > 0,
    addAir: settings.air > 0,
    tapeWarmth: settings.warmth > 0,
    addPunch: settings.autoLevelStrength >= 50,
    cleanLowEnd: settings.lowEndClean > 0,
    glueCompression: settings.glueCompression > 0,
    centerBass: settings.monoBassAnchor,
    stereoWidth: settings.stereoWidth,
    ...EQ_BASE
  };
}

function readSettingsFromStorage(): MasteringSettings {
  if (typeof window === "undefined") {
    return { ...DEFAULT_MASTERING_SETTINGS };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.settings);
    if (!raw) return { ...DEFAULT_MASTERING_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<MasteringSettings>;
    return sanitizeSettings(parsed);
  } catch {
    return { ...DEFAULT_MASTERING_SETTINGS };
  }
}

function readPresetFromStorage(): MasteringPresetId {
  if (typeof window === "undefined") {
    return DEFAULT_PRESET_ID;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.preset);
    if (!raw) return DEFAULT_PRESET_ID;
    if (
      raw === "transparent" ||
      raw === "velvet-lift" ||
      raw === "crystal-air" ||
      raw === "punch-glue" ||
      raw === "wide-cinema" ||
      raw === "broadcast-calm" ||
      raw === "custom"
    ) {
      return raw;
    }
  } catch {
    return DEFAULT_PRESET_ID;
  }

  return DEFAULT_PRESET_ID;
}

function writeSettingsToStorage(settings: MasteringSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  } catch {
    // Ignore persistence errors in private mode or restricted environments.
  }
}

function writePresetToStorage(presetId: MasteringPresetId) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEYS.preset, presetId);
  } catch {
    // Ignore persistence errors in private mode or restricted environments.
  }
}

function sanitizeSettings(patch: Partial<MasteringSettings>): MasteringSettings {
  return {
    targetLufs: clampNumber(patch.targetLufs, -20, -8, DEFAULT_MASTERING_SETTINGS.targetLufs),
    truePeakCeiling: clampNumber(
      patch.truePeakCeiling,
      -2,
      -0.1,
      DEFAULT_MASTERING_SETTINGS.truePeakCeiling
    ),
    outputTrimDb: clampNumber(patch.outputTrimDb, -6, 6, DEFAULT_MASTERING_SETTINGS.outputTrimDb),
    normalizeLoudness:
      typeof patch.normalizeLoudness === "boolean"
        ? patch.normalizeLoudness
        : DEFAULT_MASTERING_SETTINGS.normalizeLoudness,
    warmth: clampNumber(patch.warmth, 0, 100, DEFAULT_MASTERING_SETTINGS.warmth),
    clarity: clampNumber(patch.clarity, 0, 100, DEFAULT_MASTERING_SETTINGS.clarity),
    air: clampNumber(patch.air, 0, 100, DEFAULT_MASTERING_SETTINGS.air),
    lowEndClean: clampNumber(patch.lowEndClean, 0, 100, DEFAULT_MASTERING_SETTINGS.lowEndClean),
    stereoWidth: Math.round(
      clampNumber(patch.stereoWidth, 80, 140, DEFAULT_MASTERING_SETTINGS.stereoWidth)
    ),
    spaceDepth: clampNumber(patch.spaceDepth, 0, 100, DEFAULT_MASTERING_SETTINGS.spaceDepth),
    monoBassAnchor:
      typeof patch.monoBassAnchor === "boolean"
        ? patch.monoBassAnchor
        : DEFAULT_MASTERING_SETTINGS.monoBassAnchor,
    glueCompression: clampNumber(
      patch.glueCompression,
      0,
      100,
      DEFAULT_MASTERING_SETTINGS.glueCompression
    ),
    autoLevelStrength: clampNumber(
      patch.autoLevelStrength,
      0,
      100,
      DEFAULT_MASTERING_SETTINGS.autoLevelStrength
    ),
    sampleRate: patch.sampleRate === 44100 ? 44100 : 48000,
    bitDepth: patch.bitDepth === 16 ? 16 : 24,
    ditherMode:
      patch.ditherMode === "tpdf" || patch.ditherMode === "noise-shaped"
        ? patch.ditherMode
        : "none"
  };
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}
