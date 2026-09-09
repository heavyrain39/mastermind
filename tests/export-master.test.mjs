import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";

function setup() {
  const calls = [];
  const bytes = new Uint8Array([82, 73, 70, 70, 1, 2, 3]);
  const metadata = { common: { title: "Preserved title" } };
  const track = { masteredUrl: "blob:master", masteredSampleRate: 48000, masteredMetadata: metadata };
  const settings = { outputFormat: "wav", sampleRate: 48000, bitDepth: 24, ditherMode: "none", mp3Bitrate: 320 };
  const decoded = { sampleRate: 48000 };
  const resampled = { sampleRate: 44100 };
  const { exportMaster } = loadTs(new URL("../src/lib/audio/exportMaster.ts", import.meta.url), {
    globals: { fetch: async () => new Response(bytes) },
    imports: {
      "./wav": { resampleAudioBuffer: async (buffer, rate) => { calls.push(["resample", buffer, rate]); return resampled; } },
      "./wavWorkerClient": { encodeWavInWorker: async (buffer, options) => { calls.push(["wav", buffer, options]); return new Blob(["wav"]); } },
      "./mp3": { encodeMp3: async (buffer, bitrate, progress, tags) => { calls.push(["mp3", buffer, bitrate, tags]); progress?.(100); return new Blob(["mp3"]); } }
    }
  });
  const getContext = () => ({ decodeAudioData: async () => { calls.push(["decode"]); return decoded; } });
  return { exportMaster, track, settings, metadata, calls, bytes, getContext, resampled };
}

test("matching 24-bit WAV exports reuse exact bytes without decoding", async () => {
  const s = setup();
  // Dither is inactive at 24 bits, so a retained 16-bit preference is harmless.
  for (const ditherMode of ["none", "tpdf", "noise-shaped"]) {
    const blob = await s.exportMaster(s.track, { ...s.settings, ditherMode }, s.getContext, s.metadata);
    assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), s.bytes);
  }
  assert.equal(s.calls.length, 0);
});

test("changed output format, rate, depth or metadata still performs conversion", async () => {
  for (const patch of [{ sampleRate: 44100 }, { bitDepth: 16, ditherMode: "tpdf" }, { outputFormat: "mp3" }, { metadata: { common: { title: "New title" } } }]) {
    const s = setup();
    const { metadata = s.metadata, ...settingsPatch } = patch;
    const settings = { ...s.settings, ...settingsPatch };
    let progress = 0;
    await s.exportMaster(s.track, settings, s.getContext, metadata, (p) => { progress = p; });
    assert.deepEqual(s.calls.map((c) => c[0]), ["decode", "resample", settings.outputFormat]);
    assert.equal(s.calls[1][2], settings.sampleRate);
    const encode = s.calls[2];
    assert.equal(encode[1], s.resampled);
    if (settings.outputFormat === "wav") {
      assert.equal(encode[2].bitDepth, settings.bitDepth);
      assert.equal(encode[2].ditherMode, settings.ditherMode);
      assert.equal(encode[2].metadata, metadata);
    } else {
      assert.equal(encode[2], 320);
      assert.equal(encode[3], metadata);
      assert.equal(progress, 100);
    }
  }
});
