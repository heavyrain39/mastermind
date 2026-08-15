import type { WavEncodeOptions } from "./wav";

type PendingRequest = {
  resolve: (blob: Blob) => void;
  reject: (reason?: unknown) => void;
};

let worker: Worker | null = null;
let nextRequestId = 1;
const pendingRequests = new Map<number, PendingRequest>();

function getWorker() {
  if (worker) return worker;

  worker = new Worker(new URL("./wav-worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (event: MessageEvent) => {
    const payload = event.data as {
      id: number;
      success: boolean;
      result?: Uint8Array;
      error?: string;
    };
    const pending = pendingRequests.get(payload.id);
    if (!pending) return;
    pendingRequests.delete(payload.id);

    if (payload.success && payload.result) {
      const safeBytes = new Uint8Array(payload.result.byteLength);
      safeBytes.set(payload.result);
      pending.resolve(new Blob([safeBytes.buffer], { type: "audio/wav" }));
    } else {
      pending.reject(new Error(payload.error || "WAV encoding failed"));
    }
  };
  worker.onerror = (event) => {
    const error = event.error ?? new Error("WAV worker error");
    for (const pending of pendingRequests.values()) pending.reject(error);
    pendingRequests.clear();
    worker?.terminate();
    worker = null;
  };

  return worker;
}

export function encodeWavInWorker(
  audioBuffer: AudioBuffer,
  options: WavEncodeOptions = {}
): Promise<Blob> {
  const channels: Float32Array[] = [];
  const transferables: ArrayBuffer[] = [];
  for (let channelIndex = 0; channelIndex < audioBuffer.numberOfChannels; channelIndex++) {
    const copy = audioBuffer.getChannelData(channelIndex).slice();
    channels.push(copy);
    transferables.push(copy.buffer as ArrayBuffer);
  }

  const id = nextRequestId++;
  return new Promise<Blob>((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
    try {
      getWorker().postMessage({
        type: "ENCODE_WAV",
        id,
        data: { channels, sampleRate: audioBuffer.sampleRate, options }
      }, transferables);
    } catch (error) {
      pendingRequests.delete(id);
      reject(error);
    }
  });
}

export function terminateWavWorker() {
  worker?.terminate();
  worker = null;
  const error = new Error("WAV worker terminated");
  for (const pending of pendingRequests.values()) pending.reject(error);
  pendingRequests.clear();
}
