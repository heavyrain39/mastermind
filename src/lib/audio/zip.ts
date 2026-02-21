/**
 * ZIP 압축 Worker 클라이언트
 *
 * JSZip 압축 과정을 Web Worker에 위임하여 메인 스레드 UI Freeze를 방지합니다.
 */

type PendingZipRequest = {
    resolve: (blob: Blob) => void;
    reject: (reason?: unknown) => void;
    onProgress?: (percent: number) => void;
};

let worker: Worker | null = null;
const pending = new Map<number, PendingZipRequest>();
let nextId = 1;

function getWorker(): Worker {
    if (worker) return worker;

    worker = new Worker(
        new URL("/workers/zip-worker.js", import.meta.url)
    );

    worker.onmessage = (event: MessageEvent) => {
        const payload = event.data as {
            id: number;
            type?: string;
            progress?: number;
            success?: boolean;
            result?: { zipBlob: Blob };
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
            request.resolve(payload.result.zipBlob);
        } else {
            request.reject(new Error(payload.error || "ZIP generation failed"));
        }
    };

    worker.onerror = (event) => {
        for (const req of pending.values()) {
            req.reject(event.error ?? new Error("ZIP worker error"));
        }
        pending.clear();
    };

    return worker;
}

/**
 * 파일 목록을 ZIP Blob으로 비동기 압축합니다.
 *
 * @param files       압축할 파일 목록 { name: string, data: Blob | ArrayBuffer }
 * @param onProgress  진행률 콜백 (0~100)
 */
export function generateZipInWorker(
    files: { name: string; data: Blob | ArrayBuffer }[],
    onProgress?: (percent: number) => void
): Promise<Blob> {
    const w = getWorker();

    return new Promise<Blob>((resolve, reject) => {
        const id = nextId++;
        pending.set(id, { resolve, reject, onProgress });

        try {
            w.postMessage({
                type: "GENERATE_ZIP",
                id,
                data: { files }
            });
        } catch (err) {
            pending.delete(id);
            reject(err);
        }
    });
}
