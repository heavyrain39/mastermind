import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { FiTrash2, FiDownload } from "react-icons/fi";
import { useQueue } from "./QueueProvider";
import { ScrollArea } from "../../shared/ui/ScrollArea";
import type { UiLocale } from "../../shared/i18n/useUiLocale";
import { getUiTips } from "../../shared/i18n/uiTips";

interface QueuePanelProps {
  locale: UiLocale;
}

export function QueuePanel({ locale }: QueuePanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const toggleAllRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const tips = getUiTips(locale);
  const {
    tracks,
    activeTrackId,
    isProcessing,
    addFiles,
    setActiveTrackId,
    toggleTrackSelected,
    selectAllTracks,
    removeTrack,
    processSelectedTracks,
    cancelProcessing,
    downloadTrack,
    downloadingTrackIds,
    downloadProgress
  } = useQueue();

  const selectedCount = useMemo(
    () => tracks.filter((track) => track.selected).length,
    [tracks]
  );

  const allSelected = tracks.length > 0 && selectedCount === tracks.length;
  const partiallySelected = selectedCount > 0 && !allSelected;

  useEffect(() => {
    if (toggleAllRef.current) {
      toggleAllRef.current.indeterminate = partiallySelected;
    }
  }, [partiallySelected]);

  const totalCount = tracks.length;
  const doneCount = tracks.filter((t) => t.status === "done").length;
  const errorCount = tracks.filter((t) => t.status === "error").length;

  const hasStarted = tracks.some(
    (t) => t.status === "processing" || t.status === "queued" || t.status === "done" || t.status === "error"
  );

  const totalProgressPercent = useMemo(() => {
    if (totalCount === 0) return 0;
    let accumulated = 0;
    tracks.forEach((t) => {
      if (t.status === "done" || t.status === "error") {
        accumulated += 100;
      } else if (t.status === "processing" && typeof t.progressPercent === "number") {
        accumulated += t.progressPercent;
      }
    });
    return accumulated / totalCount;
  }, [tracks, totalCount]);

  const onClickUpload = () => {
    inputRef.current?.click();
  };

  const onChangeFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    addFiles(files);
    event.target.value = "";
  };

  const onDropFiles = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    const files = Array.from(event.dataTransfer.files ?? []);
    addFiles(files);
  };

  return (
    <section className="panel queue-panel">
      <div className="panel-head">
        <h2>Track Queue</h2>
        <span className="meta-chip">{tracks.length} tracks</span>
      </div>

      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        multiple
        accept=".wav,.wave,.mp3,.m4a,.aac,.ogg,.flac,audio/*"
        onChange={onChangeFiles}
      />

      <div
        className={`queue-dropzone ${isDragOver ? "is-drag-over" : ""} ${isProcessing ? "is-disabled" : ""}`}
        onDragOver={(event) => {
          if (isProcessing) return;
          event.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(event) => {
          if (isProcessing) return;
          onDropFiles(event);
        }}
      >
        Drop audio files here (WAV · MP3 · M4A · OGG · FLAC)
      </div>

      <div className="queue-controls-section">
        <div className="queue-actions">
          <button
            type="button"
            onClick={onClickUpload}
            disabled={isProcessing}
            className="primary-action-btn has-tooltip"
            data-tooltip={tips.queue.uploadWav}
          >
            Upload
          </button>
          <button
            type="button"
            onClick={isProcessing ? cancelProcessing : processSelectedTracks}
            disabled={!isProcessing && selectedCount === 0}
            className="primary-action-btn has-tooltip"
            data-tooltip={isProcessing ? "Stop processing" : tips.queue.processSelected}
          >
            {isProcessing ? "Stop" : "Start"}
          </button>
        </div>

        {hasStarted && (
          <div className="global-progress-wrap">
            <div className="global-progress-text">
              <span>{doneCount + errorCount} / {totalCount} tracks done.</span>
              <span>({Math.min(100, Math.max(0, Math.round(totalProgressPercent)))}%)</span>
            </div>
            <div className="global-progress-track">
              <div
                className="global-progress-fill"
                style={{ width: `${Math.min(100, Math.max(0, totalProgressPercent))}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="queue-list-head">
        <label className="track-select has-tooltip" data-tooltip={tips.queue.selectAll}>
          <input
            ref={toggleAllRef}
            type="checkbox"
            checked={allSelected}
            onChange={(event) => selectAllTracks(event.currentTarget.checked)}
            disabled={tracks.length === 0}
          />
        </label>
        <span>Uploaded Track</span>
        <span></span>
      </div>

      <ScrollArea className="queue-scroll">
        <ul className="track-list">
          {tracks.map((track) => (
            <li
              key={track.id}
              className={`track-row ${track.id === activeTrackId ? "is-active-track" : ""}`}
            >
              <div className="track-main compact">
                <label className="track-select has-tooltip" data-tooltip={tips.queue.selectTrack}>
                  <input
                    type="checkbox"
                    checked={track.selected}
                    onChange={() => toggleTrackSelected(track.id)}
                  />
                </label>
                <button
                  type="button"
                  className="track-name-btn has-tooltip"
                  data-tooltip={tips.queue.setActiveTrack}
                  onClick={() => setActiveTrackId(track.id)}
                >
                  <strong>{track.fileName}</strong>
                </button>
                {track.status === "done" ? (
                  <button
                    type="button"
                    className="icon-btn has-tooltip"
                    data-tooltip={tips.queue.downloadTrack}
                    aria-label={`Download ${track.fileName}`}
                    disabled={downloadingTrackIds.includes(track.id)}
                    onClick={(event) => {
                      event.stopPropagation();
                      downloadTrack(track.id);
                    }}
                  >
                    {downloadingTrackIds.includes(track.id) ? (
                      <span className="spinner" aria-hidden />
                    ) : (
                      <FiDownload aria-hidden />
                    )}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="icon-btn danger has-tooltip"
                  data-tooltip={tips.queue.removeTrack}
                  onClick={() => removeTrack(track.id)}
                  disabled={isProcessing}
                  aria-label={`Remove ${track.fileName}`}
                >
                  <FiTrash2 aria-hidden />
                </button>
              </div>
              {(() => {
                const encodingPct = downloadProgress.get(track.id);
                const isEncoding = typeof encodingPct === "number";
                const isProcessingTrack = typeof track.progressPercent === "number" && track.status === "processing";
                if (isEncoding) {
                  return (
                    <div className="track-progress wide">
                      <div
                        className="track-progress-fill"
                        style={{ width: `${Math.max(0, Math.min(100, encodingPct))}%` }}
                      />
                    </div>
                  );
                }
                if (isProcessingTrack) {
                  return (
                    <div className="track-progress wide">
                      <div
                        className="track-progress-fill"
                        style={{ width: `${Math.max(0, Math.min(100, track.progressPercent!))}%` }}
                      />
                    </div>
                  );
                }
                return null;
              })()}
              {track.status === "error" && track.errorMessage ? (
                <div className="track-error">{track.errorMessage}</div>
              ) : null}
            </li>
          ))}
          {tracks.length === 0 ? (
            <li className="track-empty">No tracks yet. Click Upload or drag files into the queue.</li>
          ) : null}
        </ul>
      </ScrollArea>
    </section>
  );
}

