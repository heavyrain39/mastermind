/**
 * MP3 인코딩 Worker 클라이언트
 *
 * lamejs 인코딩을 Web Worker에 위임하여 메인 스레드 UI Freeze를 방지합니다.
 * DSPWorkerClient와 동일한 postMessage ↔ onmessage 패턴을 사용합니다.
 */

type PendingMp3Request = {
    resolve: (blob: Blob) => void;
    reject: (reason?: unknown) => void;
    onProgress?: (percent: number) => void;
};

let worker: Worker | null = null;
const pending = new Map<number, PendingMp3Request>();
let nextId = 1;

function getWorker(): Worker {
    if (worker) return worker;

    worker = new Worker(
        new URL("../../../../web/workers/mp3-worker.js", import.meta.url)
    );

    worker.onmessage = (event: MessageEvent) => {
        const payload = event.data as {
            id: number;
            type?: string;
            progress?: number;
            success?: boolean;
            result?: { mp3Blob: Blob };
            error?: string;
        };

        const request = pending.get(payload.id);
        if (!request) return;

        if (payload.type === "PROGRESS") {
            request.onProgress?.(payload.progress ?? 0);
            return;
        }

        pending.delete(payload.id);
        if (payload.success && payload.result) {
            request.resolve(payload.result.mp3Blob);
        } else {
            request.reject(new Error(payload.error || "MP3 encoding failed"));
        }
    };

    worker.onerror = (event) => {
        for (const req of pending.values()) {
            req.reject(event.error ?? new Error("MP3 worker error"));
        }
        pending.clear();
    };

    return worker;
}

/**
 * AudioBuffer를 MP3 Blob으로 비동기 인코딩합니다.
 * 인코딩은 Web Worker에서 수행되므로 메인 스레드가 블로킹되지 않습니다.
 *
 * @param audioBuffer  마스터링된 오디오 버퍼
 * @param bitrate      MP3 비트레이트 (128~320)
 * @param onProgress   진행률 콜백 (0~100)
 */
export function encodeMp3(
    audioBuffer: AudioBuffer,
    bitrate: number = 192,
    onProgress?: (percent: number) => void
): Promise<Blob> {
    const w = getWorker();
    const numberOfChannels = audioBuffer.numberOfChannels;

    // Float32Array 채널 데이터를 복사해서 Transferable로 전송
    const channels: Float32Array[] = [];
    const transferables: ArrayBuffer[] = [];

    for (let i = 0; i < numberOfChannels; i++) {
        const copy = audioBuffer.getChannelData(i).slice();
        channels.push(copy);
        transferables.push(copy.buffer as ArrayBuffer);
    }

    return new Promise<Blob>((resolve, reject) => {
        const id = nextId++;
        pending.set(id, { resolve, reject, onProgress });

        try {
            w.postMessage(
                {
                    type: "ENCODE_MP3",
                    id,
                    data: {
                        channels,
                        sampleRate: audioBuffer.sampleRate,
                        bitrate
                    }
                },
                transferables
            );
        } catch (err) {
            pending.delete(id);
            reject(err);
        }
    });
}

/**
 * (하위 호환) 기존 동기 함수 시그니처 래핑 — 사용 금지, 참조 전용
 * @deprecated Use encodeMp3() instead
 */
export async function audioBufferToMp3Blob(
    audioBuffer: AudioBuffer,
    bitrate: number = 192
): Promise<Blob> {
    return encodeMp3(audioBuffer, bitrate);
}
