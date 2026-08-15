import { encodePcmChannelsToWav, type WavEncodeOptions } from "./wav";

type EncodeWavRequest = {
  type: "ENCODE_WAV";
  id: number;
  data: {
    channels: Float32Array[];
    sampleRate: number;
    options: WavEncodeOptions;
  };
};

self.onmessage = (event: MessageEvent<EncodeWavRequest>) => {
  const { id, data } = event.data;
  try {
    const bytes = encodePcmChannelsToWav(data.channels, data.sampleRate, data.options);
    (self as unknown as {
      postMessage: (message: unknown, transfer: Transferable[]) => void;
    }).postMessage({ id, success: true, result: bytes }, [bytes.buffer as ArrayBuffer]);
  } catch (error) {
    self.postMessage({
      id,
      success: false,
      error: error instanceof Error ? error.message : "WAV encoding failed"
    });
  }
};
