/**
 * MP3 인코딩 Worker 클라이언트
 *
 * lamejs 인코딩을 Web Worker에 위임하여 메인 스레드 UI Freeze를 방지합니다.
 * DSPWorkerClient와 동일한 postMessage ↔ onmessage 패턴을 사용합니다.
 */
import { generateID3v2Tag } from "./mp3-tagger";

type PendingMp3Request = {
    resolve: (blob: Blob) => void;
    reject: (reason?: unknown) => void;
    onProgress?: (percent: number) => void;
    metadata?: any;
};

interface WorkerInstance {
    worker: Worker;
    busy: boolean;
    pendingRequests: Map<number, PendingMp3Request>;
}

type WorkerWaiter = {
    resolve: (instance: WorkerInstance) => void;
    reject: (reason?: unknown) => void;
};

const workerInstances: WorkerInstance[] = [];
const maxWorkers = Math.min(4, navigator.hardwareConcurrency || 4);
const taskQueue: WorkerWaiter[] = [];
let nextRequestId = 1;

function initWorker(): WorkerInstance {
    const worker = new Worker(
        new URL("/workers/mp3-worker.js", import.meta.url)
    );

    const instance: WorkerInstance = {
        worker,
        busy: false,
        pendingRequests: new Map()
    };

    worker.onmessage = (event: MessageEvent) => {
        const payload = event.data as {
            id: number;
            type?: string;
            progress?: number;
            success?: boolean;
            result?: { mp3Blob: Blob };
            error?: string;
        };

        const request = instance.pendingRequests.get(payload.id);
        if (!request) return;

        if (payload.type === "PROGRESS") {
            request.onProgress?.(payload.progress ?? 0);
            return;
        }

        instance.pendingRequests.delete(payload.id);

        if (payload.success && payload.result) {
            request.resolve(payload.result.mp3Blob);
        } else {
            request.reject(new Error(payload.error || "MP3 encoding failed"));
        }

        releaseInstance(instance);
    };

    worker.onerror = (event) => {
        const error = event.error ?? new Error("MP3 worker error");
        for (const req of instance.pendingRequests.values()) {
            req.reject(error);
        }
        instance.pendingRequests.clear();
        instance.worker.terminate();
        const failedIndex = workerInstances.indexOf(instance);
        if (failedIndex >= 0) workerInstances.splice(failedIndex, 1);
        replaceFailedWorkers();
    };

    workerInstances.push(instance);
    return instance;
}

async function getAvailableInstance(): Promise<WorkerInstance> {
    const freeInstance = workerInstances.find(i => !i.busy);
    if (freeInstance) {
        freeInstance.busy = true;
        return freeInstance;
    }

    if (workerInstances.length < maxWorkers) {
        const instance = initWorker();
        instance.busy = true;
        return instance;
    }

    return new Promise<WorkerInstance>((resolve, reject) => {
        taskQueue.push({ resolve, reject });
    });
}

function releaseInstance(instance: WorkerInstance) {
    const waiter = taskQueue.shift();
    if (waiter) {
        instance.busy = true;
        waiter.resolve(instance);
    } else {
        instance.busy = false;
    }
}

function replaceFailedWorkers() {
    while (taskQueue.length > 0 && workerInstances.length < maxWorkers) {
        const waiter = taskQueue.shift()!;
        try {
            const instance = initWorker();
            instance.busy = true;
            waiter.resolve(instance);
        } catch (error) {
            waiter.reject(error);
        }
    }
}

/**
 * AudioBuffer를 MP3 Blob으로 비동기 인코딩합니다.
 * 인코딩은 Web Worker에서 수행되므로 메인 스레드가 블로킹되지 않습니다.
 *
 * @param audioBuffer  마스터링된 오디오 버퍼
 * @param bitrate      MP3 비트레이트 (128~320)
 * @param onProgress   진행률 콜백 (0~100)
 */
export async function encodeMp3(
    audioBuffer: AudioBuffer,
    bitrate: number = 192,
    onProgress?: (percent: number) => void,
    metadata?: any
): Promise<Blob> {
    const instance = await getAvailableInstance();

    const numberOfChannels = audioBuffer.numberOfChannels;
    const channels: Float32Array[] = [];
    const transferables: ArrayBuffer[] = [];

    for (let i = 0; i < numberOfChannels; i++) {
        const copy = audioBuffer.getChannelData(i).slice();
        channels.push(copy);
        transferables.push(copy.buffer as ArrayBuffer);
    }

    return new Promise<Blob>((resolve, reject) => {
        const id = nextRequestId++;
        instance.pendingRequests.set(id, { resolve, reject, onProgress });

        const tagBuffer = generateID3v2Tag(metadata);
        if (tagBuffer.length > 0) {
            transferables.push(tagBuffer.buffer as ArrayBuffer);
        }

        try {
            instance.worker.postMessage(
                {
                    type: "ENCODE_MP3",
                    id,
                    data: {
                        channels,
                        sampleRate: audioBuffer.sampleRate,
                        bitrate,
                        tagBuffer
                    }
                },
                transferables
            );
        } catch (err) {
            instance.pendingRequests.delete(id);
            releaseInstance(instance);
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
