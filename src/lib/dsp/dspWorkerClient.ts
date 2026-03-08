type WorkerRequestType = "MEASURE_LUFS" | "RENDER_FULL_CHAIN" | "NORMALIZE";

type PendingRequest = {
  resolve: (value: any) => void;
  reject: (reason?: unknown) => void;
  onProgress?: (progress: number, status: string) => void;
};

type ExtractedChannels = {
  channels: Float32Array[];
  sampleRate: number;
  transferables: ArrayBuffer[];
};

interface MeasureLufsResult {
  lufs: number;
}

interface RenderFullChainResult {
  channels: Float32Array[];
  lufs: number;
  measuredLufs: number;
}

interface NormalizeResult {
  channels: Float32Array[];
  currentLUFS: number;
  finalLUFS: number;
  peakDB: number;
  gainApplied?: number;
  limiterApplied?: boolean;
}

export interface FullChainSettings {
  presetId?: string;
  inputGain: number;
  normalizeLoudness: boolean;
  targetLufs: number;
  truePeakLimit: boolean;
  truePeakCeiling: number;
  centerBass: boolean;
  stereoWidth: number;
  clarityAmount?: number;
  airAmount?: number;
  warmthAmount?: number;
  lowEndCleanAmount?: number;
  glueCompressionAmount?: number;
  autoLevelAmount?: number;
  spaceDepthAmount?: number;
  eqLow: number;
  eqLowMid: number;
  eqMid: number;
  eqHighMid: number;
  eqHigh: number;
}

export interface RenderFullChainResponse {
  audioBuffer: AudioBuffer;
  lufs: number;
  measuredLufs: number;
}

export interface NormalizeResponse {
  audioBuffer: AudioBuffer;
  currentLUFS: number;
  finalLUFS: number;
  peakDB: number;
  gainApplied?: number;
  limiterApplied?: boolean;
}

interface WorkerInstance {
  worker: Worker;
  busy: boolean;
  pendingRequests: Map<number, PendingRequest>;
}

export class DSPWorkerClient {
  private workerInstances: WorkerInstance[] = [];
  private maxWorkers = Math.min(4, navigator.hardwareConcurrency || 4);
  private nextRequestId = 1;
  private taskQueue: (() => void)[] = [];

  async initWorker(): Promise<WorkerInstance> {
    const worker = new Worker(new URL("./worker.js", import.meta.url), {
      type: "module"
    });

    const instance: WorkerInstance = {
      worker,
      busy: false,
      pendingRequests: new Map()
    };

    worker.onmessage = (event) => this.handleMessage(instance, event);
    worker.onerror = (event) => {
      const error = event.error ?? new Error("DSP worker error");
      for (const pending of instance.pendingRequests.values()) {
        pending.reject(error);
      }
      instance.pendingRequests.clear();
      // 워커 에러 시 해당 인스턴스 제거 및 필요 시 재성성 로직은 복잡하므로 간단히 유지
    };

    this.workerInstances.push(instance);
    return instance;
  }

  terminate() {
    for (const instance of this.workerInstances) {
      instance.worker.terminate();
      for (const pending of instance.pendingRequests.values()) {
        pending.reject(new Error("DSP worker terminated"));
      }
      instance.pendingRequests.clear();
    }
    this.workerInstances = [];
    this.taskQueue = [];
  }

  async measureLufs(audioBuffer: AudioBuffer): Promise<MeasureLufsResult> {
    const { channels, sampleRate, transferables } = this.extractChannels(audioBuffer);
    const result = await this.send<MeasureLufsResult>(
      "MEASURE_LUFS",
      { channels, sampleRate },
      undefined,
      transferables
    );
    return result;
  }

  async renderFullChain(
    audioBuffer: AudioBuffer,
    settings: FullChainSettings,
    mode: "preview" | "export" = "export",
    onProgress?: (progress: number, status: string) => void
  ): Promise<RenderFullChainResponse> {
    const { channels, sampleRate, transferables } = this.extractChannels(audioBuffer);
    const result = await this.send<RenderFullChainResult>(
      "RENDER_FULL_CHAIN",
      { channels, sampleRate, settings, mode },
      onProgress,
      transferables
    );

    return {
      audioBuffer: this.createAudioBuffer(result.channels, sampleRate),
      lufs: result.lufs,
      measuredLufs: result.measuredLufs
    };
  }

  async normalize(
    audioBuffer: AudioBuffer,
    targetLUFS = -14,
    ceilingDB = -1,
    onProgress?: (progress: number, status: string) => void
  ): Promise<NormalizeResponse> {
    const { channels, sampleRate, transferables } = this.extractChannels(audioBuffer);
    const result = await this.send<NormalizeResult>(
      "NORMALIZE",
      { channels, sampleRate, targetLUFS, ceilingDB },
      onProgress,
      transferables
    );

    return {
      audioBuffer: this.createAudioBuffer(result.channels, sampleRate),
      currentLUFS: result.currentLUFS,
      finalLUFS: result.finalLUFS,
      peakDB: result.peakDB,
      gainApplied: result.gainApplied,
      limiterApplied: result.limiterApplied
    };
  }

  private handleMessage(instance: WorkerInstance, event: MessageEvent) {
    const payload = event.data as {
      id: number;
      type?: string;
      progress?: number;
      status?: string;
      success?: boolean;
      result?: unknown;
      error?: string;
    };

    const request = instance.pendingRequests.get(payload.id);
    if (!request) return;

    if (payload.type === "PROGRESS") {
      request.onProgress?.(payload.progress ?? 0, payload.status ?? "");
      return;
    }

    instance.pendingRequests.delete(payload.id);
    instance.busy = false; // 작업 완료 시 busy 해제

    if (payload.success) {
      request.resolve(payload.result);
    } else {
      request.reject(new Error(payload.error || "DSP worker request failed"));
    }

    // 큐에 대기 중인 작업이 있으면 실행
    this.processQueue();
  }

  private async getAvailableInstance(): Promise<WorkerInstance> {
    // 1. 노는 워커 찾기
    let instance = this.workerInstances.find(i => !i.busy);
    if (instance) return instance;

    // 2. 최대 개수 미만이면 새로 생성
    if (this.workerInstances.length < this.maxWorkers) {
      return await this.initWorker();
    }

    // 3. 꽉 찼으면 빌 때까지 대기
    return new Promise<WorkerInstance>((resolve) => {
      this.taskQueue.push(() => {
        const freeInstance = this.workerInstances.find(i => !i.busy);
        if (freeInstance) {
          resolve(freeInstance);
        }
      });
    });
  }

  private processQueue() {
    if (this.taskQueue.length > 0) {
      const freeInstance = this.workerInstances.find(i => !i.busy);
      if (freeInstance) {
        const nextTask = this.taskQueue.shift();
        if (nextTask) nextTask();
      }
    }
  }

  private async send<T>(
    type: WorkerRequestType,
    data: unknown,
    onProgress?: (progress: number, status: string) => void,
    transferables: ArrayBuffer[] = []
  ): Promise<T> {
    const instance = await this.getAvailableInstance();
    instance.busy = true;

    return new Promise<T>((resolve, reject) => {
      const id = this.nextRequestId++;
      instance.pendingRequests.set(id, { resolve, reject, onProgress });

      try {
        instance.worker.postMessage({ type, id, data }, transferables);
      } catch (error) {
        instance.pendingRequests.delete(id);
        instance.busy = false;
        reject(error);
        this.processQueue();
      }
    });
  }

  private extractChannels(audioBuffer: AudioBuffer): ExtractedChannels {
    const channels: Float32Array[] = [];
    const transferables: ArrayBuffer[] = [];

    for (let channelIndex = 0; channelIndex < audioBuffer.numberOfChannels; channelIndex += 1) {
      const copy = audioBuffer.getChannelData(channelIndex).slice();
      channels.push(copy);
      transferables.push(copy.buffer as ArrayBuffer);
    }

    return {
      channels,
      sampleRate: audioBuffer.sampleRate,
      transferables
    };
  }

  private createAudioBuffer(channels: Float32Array[], sampleRate: number): AudioBuffer {
    const output = new AudioBuffer({
      numberOfChannels: channels.length,
      length: channels[0]?.length ?? 0,
      sampleRate
    });

    for (let channelIndex = 0; channelIndex < channels.length; channelIndex += 1) {
      output.copyToChannel(new Float32Array(channels[channelIndex]), channelIndex);
    }

    return output;
  }
}

let sharedClient: DSPWorkerClient | null = null;

export async function getDSPWorkerClient() {
  if (!sharedClient) {
    sharedClient = new DSPWorkerClient();
  }
  return sharedClient;
}
