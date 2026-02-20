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
    downloadTrack
  } = useQueue();

  const selectedCount = useMemo(
    () => tracks.filter((track) => track.selected).length,
    [tracks]
  );

  const allSelected = tracks.length > 0 && selectedCount === tracks.length;
  const partiallySelected = selectedCount > 0 && !allSelected;
  const canProcess = selectedCount > 0 && !isProcessing;

  useEffect(() => {
    if (toggleAllRef.current) {
      toggleAllRef.current.indeterminate = partiallySelected;
    }
  }, [partiallySelected]);

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
        accept=".wav,.wave,audio/*"
        onChange={onChangeFiles}
      />

      <div
        className={`queue-dropzone ${isDragOver ? "is-drag-over" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={onDropFiles}
      >
        Drop audio files here
      </div>

      <div className="queue-actions">
        <button
          type="button"
          onClick={onClickUpload}
          className="primary-action-btn has-tooltip"
          data-tooltip={tips.queue.uploadWav}
        >
          Upload
        </button>
        <button
          type="button"
          onClick={processSelectedTracks}
          disabled={!canProcess}
          className="primary-action-btn has-tooltip"
          data-tooltip={tips.queue.processSelected}
        >
          Start
        </button>
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
                    onClick={(event) => {
                      event.stopPropagation();
                      downloadTrack(track.id);
                    }}
                  >
                    <FiDownload aria-hidden />
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
              {typeof track.progressPercent === "number" && track.status === "processing" ? (
                <div className="track-progress wide">
                  <div
                    className="track-progress-fill"
                    style={{ width: `${Math.max(0, Math.min(100, track.progressPercent))}%` }}
                  />
                </div>
              ) : null}
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

