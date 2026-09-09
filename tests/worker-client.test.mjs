import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";

const tick = () => new Promise((resolve) => setImmediate(resolve));
const audio = { numberOfChannels: 1, sampleRate: 48000, getChannelData: () => new Float32Array([0.1, -0.2]) };

function setup() {
  const workers = [];
  class Worker {
    constructor() { this.messages = []; workers.push(this); }
    postMessage(message) { assert.ok(!this.terminated); this.messages.push(message); }
    terminate() { this.terminated = true; }
    complete(index = 0) {
      this.onmessage({ data: { id: this.messages[index].id, success: true, result: { lufs: -14 } } });
    }
  }
  const { DSPWorkerClient } = loadTs(new URL("../src/lib/dsp/dspWorkerClient.ts", import.meta.url), {
    globals: { Worker, navigator: { hardwareConcurrency: 4 } }
  });
  return { client: new DSPWorkerClient(), workers };
}

test("four concurrent DSP requests reserve four workers; overflow waits", async () => {
  const { client, workers } = setup();
  const tasks = Array.from({ length: 5 }, () => client.measureLufs(audio));
  await tick();
  assert.equal(workers.length, 4);
  assert.deepEqual(workers.map((w) => w.messages.length), [1, 1, 1, 1]);
  workers[0].complete();
  await tick();
  assert.equal(workers[0].messages.length, 2);
  workers[0].complete(1);
  workers.slice(1).forEach((w) => w.complete());
  assert.equal((await Promise.all(tasks)).length, 5);
  client.terminate();
});

test("termination rejects both acquired and queued requests and permits a fresh run", async () => {
  for (const afterDispatch of [false, true]) {
    const { client, workers } = setup();
    const settled = Promise.allSettled(Array.from({ length: 6 }, () => client.measureLufs(audio)));
    if (afterDispatch) await tick();
    client.terminate();
    const results = await settled;
    assert.ok(results.every((r) => r.status === "rejected" && /terminated/.test(r.reason.message)));
    const fresh = client.measureLufs(audio);
    await tick();
    workers.at(-1).complete();
    assert.equal((await fresh).lufs, -14);
    client.terminate();
  }
});

test("a failed worker rejects its request and a replacement serves queued work", async () => {
  const { client, workers } = setup();
  const settled = Promise.allSettled(Array.from({ length: 5 }, () => client.measureLufs(audio)));
  await tick();
  workers[0].onerror({ error: new Error("injected worker crash") });
  await tick();
  assert.equal(workers.length, 5);
  assert.ok(workers[0].terminated);
  workers.slice(1).forEach((w) => w.complete());
  const results = await settled;
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 4);
  assert.match(results[0].reason.message, /injected/);
  client.terminate();
});
