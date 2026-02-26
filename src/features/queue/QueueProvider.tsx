import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { generateZipInWorker } from "../../lib/audio/zip";
import { type TrackItem } from "../../shared/types/audio";
import { type MasteringSettings } from "../../shared/types/mastering";
import { audioBufferToWavBlob, resampleAudioBuffer } from "../../lib/audio/wav";
import { encodeMp3 } from "../../lib/audio/mp3";
import { type DSPWorkerClient, type FullChainSettings, getDSPWorkerClient } from "../../lib/dsp/dspWorkerClient";
import {
  DEFAULT_PRESET_ID,
  type FixedPresetId,
  getPresetSettings,
  type MasteringPresetId
} from "../mastering/presets";
import * as mmb from "music-metadata-browser";

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
  cancelProcessing: () => void;
  downloadTrack: (trackId: string) => void;
  downloadDoneTracksZip: () => Promise<void>;
  isDownloadingZip: boolean;
  downloadingTrackIds: string[];
  downloadProgress: Map<string, number>;
}

const QueueContext = createContext<QueueContextValue | null>(null);

const STORAGE_KEYS = {
  settings: "mstrmnd.mastering.settings.v1",
  preset: "mstrmnd.mastering.preset.v1"
} as const;

const LEGACY_STORAGE_KEYS = {
  settings: "mastermind.mastering.settings.v1",
  preset: "mastermind.mastering.preset.v1"
} as const;

const DEFAULT_MASTERING_SETTINGS = getPresetSettings(DEFAULT_PRESET_ID);


export function QueueProvider({ children }: { children: ReactNode }) {
  const [tracks, setTracks] = useState<TrackItem[]>([]);
  const [activeTrackId, setActiveTrackIdState] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [downloadingTrackIds, setDownloadingTrackIds] = useState<string[]>([]);
  const [downloadProgress, setDownloadProgress] = useState<Map<string, number>>(new Map());
  const cancelRef = useRef(false);
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

    const outputSettings: (keyof MasteringSettings)[] = [
      "sampleRate",
      "bitDepth",
      "ditherMode",
      "outputFormat",
      "mp3Bitrate"
    ];
    const isOnlyOutputSetting = Object.keys(patch).every((key) =>
      outputSettings.includes(key as keyof MasteringSettings)
    );

    if (!isOnlyOutputSetting) {
      setSelectedPresetId("custom");
    }
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

  const cancelProcessing = () => {
    cancelRef.current = true;
  };

  const addFiles = (files: File[]) => {
    const wavFiles = files.filter(isSupportedAudioFile);
    if (wavFiles.length === 0) return;

    const createdTracks = wavFiles.map((file) => createTrack(file, sequenceRef.current++));
    setTracks((prev) => [...prev, ...createdTracks]);
    setActiveTrackIdState((prev) => prev ?? createdTracks[0]?.id ?? null);

    // 비동기 메타데이터 추출 (Background pre-cache)
    createdTracks.forEach((track) => {
      void ensureMetadata(track);
    });
  };

  const ensureMetadata = async (track: TrackItem) => {
    if (track.metadata) return track.metadata;
    try {
      const metadata = await mmb.parseBlob(track.sourceFile);
      setTracks((prev) =>
        prev.map((t) => (t.id === track.id ? { ...t, metadata } : t))
      );
      return metadata;
    } catch (err) {
      console.warn(`[Metadata] Failed to extract for ${track.fileName}:`, err);
      return undefined;
    }
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

  const downloadTrack = async (trackId: string) => {
    const target = tracksRef.current.find((track) => track.id === trackId);
    if (!target?.masteredBuffer || !target.masteredUrl) return;

    const settings = settingsRef.current;

    setDownloadingTrackIds((prev) => [...prev, trackId]);
    setDownloadProgress((prev) => { const next = new Map(prev); next.set(trackId, 0); return next; });

    try {
      const metadata = await ensureMetadata(target);
      if (settings.outputFormat === "wav") {
        triggerDownload(
          target.masteredUrl,
          deriveMasteredFileName(target.fileName, "wav")
        );
        return;
      }

      const outputBuffer = await resampleAudioBuffer(target.masteredBuffer, settings.sampleRate);
      const mp3Blob = await encodeMp3(outputBuffer, settings.mp3Bitrate, (percent) => {
        setDownloadProgress((prev) => { const next = new Map(prev); next.set(trackId, percent); return next; });
      }, metadata);
      const url = URL.createObjectURL(mp3Blob);

      triggerDownload(
        url,
        deriveMasteredFileName(target.fileName, "mp3")
      );
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (error) {
      console.error("MP3 Encoding failed:", error);
      alert(`MP3 인코딩에 실패했습니다. (Error: ${error instanceof Error ? error.message : "Unknown"})`);
    } finally {
      setDownloadingTrackIds((prev) => prev.filter((id) => id !== trackId));
      setDownloadProgress((prev) => { const next = new Map(prev); next.delete(trackId); return next; });
    }
  };

  const downloadDoneTracksZip = async () => {
    const doneTracks = tracksRef.current.filter((track) => track.status === "done" && track.masteredBuffer);
    if (doneTracks.length === 0) return;

    setIsDownloadingZip(true);
    const settings = settingsRef.current;
    const filesToZip: { name: string; data: Blob }[] = [];

    try {
      // 병렬 MP3 인코딩 처리 (최대 4개)
      const CONCURRENCY = 4;
      const queue = [...doneTracks];
      const filesToZip: { name: string; data: Blob }[] = [];

      const encodeTask = async () => {
        while (queue.length > 0) {
          const track = queue.shift();
          if (!track) break;

          const fileName = deriveMasteredFileName(track.fileName, settings.outputFormat);
          let blob: Blob;

          if (settings.outputFormat === "wav" && track.masteredUrl) {
            const response = await fetch(track.masteredUrl);
            blob = await response.blob();
          } else if (settings.outputFormat === "mp3") {
            const trackMetadata = await ensureMetadata(track);
            const outputBuffer = await resampleAudioBuffer(track.masteredBuffer!, settings.sampleRate);
            blob = await encodeMp3(outputBuffer, settings.mp3Bitrate, undefined, trackMetadata);
          } else {
            const trackMetadata = await ensureMetadata(track);
            const outputBuffer = await resampleAudioBuffer(track.masteredBuffer!, settings.sampleRate);
            blob = audioBufferToWavBlob(outputBuffer, { bitDepth: settings.bitDepth, ditherMode: settings.ditherMode, metadata: trackMetadata });
          }

          filesToZip.push({ name: fileName, data: blob });
        }
      };

      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, doneTracks.length) }, encodeTask));

      const zipBlob = await generateZipInWorker(filesToZip);

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const zipUrl = URL.createObjectURL(zipBlob);
      triggerDownload(zipUrl, `mstrmnd-mastered-${timestamp}.zip`);
      window.setTimeout(() => URL.revokeObjectURL(zipUrl), 2000);
    } catch (error) {
      console.error("ZIP Generation failed:", error);
      alert(`파일 변환 및 다운로드에 실패했습니다. (Error: ${error instanceof Error ? error.message : "Unknown"})`);
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const processTracks = async (trackIds: string[]) => {
    if (trackIds.length === 0 || isProcessing) return;
    setIsProcessing(true);
    cancelRef.current = false;

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

      const CONCURRENCY = 4;
      const taskQueue = [...targets];

      const processTrack = async (trackId: string) => {
        const sourceTrack = tracksRef.current.find((track) => track.id === trackId);
        if (!sourceTrack) return;

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
          const trackMetadata = await ensureMetadata(sourceTrack);
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
              (progress: number, status: string) => {
                const percent = Math.max(6, Math.min(96, Math.round(progress * 90 + 6)));
                setTracks((prev) =>
                  prev.map((track) =>
                    track.id === trackId
                      ? {
                        ...track,
                        progressPercent: Math.max(track.progressPercent || 0, percent),
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
                    progressPercent: Math.max(track.progressPercent || 0, 60),
                    progressStatus: "Fallback rendering (safe normalize)"
                  }
                  : track
              )
            );
            const normalized = await workerClient.normalize(
              originalBuffer,
              selectedSettings.targetLufs,
              selectedSettings.truePeakCeiling,
              (progress: number, status: string) => {
                const percent = Math.max(60, Math.min(96, Math.round(progress * 36 + 60)));
                setTracks((prev) =>
                  prev.map((track) =>
                    track.id === trackId
                      ? {
                        ...track,
                        progressPercent: Math.max(track.progressPercent || 0, percent),
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

          if (cancelRef.current) return;

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
            ditherMode: selectedSettings.ditherMode,
            metadata: trackMetadata
          });
          const nextMasteredUrl = URL.createObjectURL(masteredBlob);
          const nextFileName = deriveMasteredFileName(
            sourceTrack.fileName,
            selectedSettings.outputFormat
          );

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
                masteredPresetId: selectedSettings.presetId,
                masteredBuffer: masteredBuffer,
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
      };

      const workerLoop = async () => {
        while (taskQueue.length > 0 && !cancelRef.current) {
          const trackId = taskQueue.shift();
          if (trackId) {
            await processTrack(trackId);
          }
        }
      };

      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, workerLoop));

      if (cancelRef.current) {
        setTracks((prev) =>
          prev.map((track) =>
            track.status === "queued" || track.status === "processing"
              ? { ...track, status: "idle", progressStatus: undefined, progressPercent: undefined }
              : track
          )
        );
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const processSelectedTracks = async () => {
    const ids = tracksRef.current.filter((track) => track.selected).map((track) => track.id);
    await processTracks(ids);
  };

  // on-demand 다운로드 방식으로 변경되어 updateOutputs 훅을 삭제했습니다.
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
    cancelProcessing,
    downloadTrack,
    downloadDoneTracksZip,
    isDownloadingZip,
    downloadingTrackIds,
    downloadProgress
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
  if (
    lowerName.endsWith(".wav") ||
    lowerName.endsWith(".wave") ||
    lowerName.endsWith(".mp3") ||
    lowerName.endsWith(".m4a") ||
    lowerName.endsWith(".aac") ||
    lowerName.endsWith(".ogg") ||
    lowerName.endsWith(".flac")
  ) {
    return true;
  }
  if (
    file.type === "audio/wav" ||
    file.type === "audio/x-wav" ||
    file.type === "audio/wave"
  ) {
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

function deriveMasteredFileName(fileName: string, format: "wav" | "mp3" = "wav") {
  return `${fileName.replace(/\.[^.]+$/, "")}_mastered.${format}`;
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
    eqLow: 0,
    eqLowMid: 0,
    eqMid: 0,
    eqHighMid: 0,
    eqHigh: 0
  };
}

function readSettingsFromStorage(): MasteringSettings {
  if (typeof window === "undefined") {
    return { ...DEFAULT_MASTERING_SETTINGS };
  }

  try {
    const raw = readStorageWithLegacyKey(STORAGE_KEYS.settings, LEGACY_STORAGE_KEYS.settings);
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
    const raw = readStorageWithLegacyKey(STORAGE_KEYS.preset, LEGACY_STORAGE_KEYS.preset);
    if (!raw) return DEFAULT_PRESET_ID;
    if (
      raw === "none" ||
      raw === "transparent" ||
      raw === "warm-tape" ||
      raw === "crystal-air" ||
      raw === "punch-glue" ||
      raw === "wide-cinema" ||
      raw === "loud-clear" ||
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

function readStorageWithLegacyKey(primaryKey: string, legacyKey: string): string | null {
  const current = window.localStorage.getItem(primaryKey);
  if (current !== null) {
    return current;
  }

  const legacy = window.localStorage.getItem(legacyKey);
  if (legacy !== null) {
    window.localStorage.setItem(primaryKey, legacy);
    return legacy;
  }

  return null;
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
        : "none",
    outputFormat: patch.outputFormat === "mp3" ? "mp3" : "wav",
    mp3Bitrate: [128, 192, 256, 320].includes(patch.mp3Bitrate as number)
      ? (patch.mp3Bitrate as any)
      : 192
  };
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}
