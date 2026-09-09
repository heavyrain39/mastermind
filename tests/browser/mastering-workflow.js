// Run against the production preview with playwright-cli run-code --filename.
// Fixtures: node tests/helpers/create-audio-fixtures.mjs
async (page) => {
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.evaluate(() => {
    window.audioAudit = { mode: "normal", messages: [], revoked: [] };
    const post = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (message, ...args) {
      window.audioAudit.messages.push(message.type);
      if (message.type === "RENDER_FULL_CHAIN") {
        if (window.audioAudit.mode === "hold") return;
        if (window.audioAudit.mode === "fail") {
          queueMicrotask(() => this.dispatchEvent(new MessageEvent("message", {
            data: { id: message.id, success: false, error: "Injected render failure" }
          })));
          return;
        }
      }
      return post.call(this, message, ...args);
    };
    const revoke = URL.revokeObjectURL;
    URL.revokeObjectURL = function (url) {
      window.audioAudit.revoked.push(url);
      return revoke.call(this, url);
    };
  });

  const choose = async (label, option) => {
    await page.getByRole("button", { name: label, exact: true }).click();
    await page.getByRole("option", { name: option, exact: true }).click();
  };
  const download = async (buttonName, filename) => {
    const event = page.waitForEvent("download");
    await page.getByRole("button", { name: buttonName, exact: true }).click();
    const result = await event;
    check(await result.failure() === null, `Download failed: ${filename}`);
    await result.saveAs(`output/playwright/${filename}`);
  };
  const waitDone = () => page.getByText("1 / 1 tracks done.", { exact: true }).waitFor();
  const start = () => page.getByRole("button", { name: "Start", exact: true }).click();
  const upload = (name) => page.getByRole("button", { name: "Choose File", exact: true }).setInputFiles(`output/playwright/${name}`);

  await upload("review-tone.wav");
  await start();
  await waitDone();
  check(await page.getByText("Mastered [ Transparent ]", { exact: true }).isVisible(), "Preset label lost");

  // Exercise A/B switching and LUFS matching using the real audio elements.
  await page.getByRole("button", { name: "Play", exact: true }).nth(0).click();
  await page.waitForFunction(() => !document.querySelectorAll("audio")[0].paused);
  await page.getByRole("checkbox", { name: "LUFS Match", exact: true }).check();
  await page.getByRole("button", { name: "Play", exact: true }).last().click();
  await page.waitForFunction(() => {
    const [a, b] = document.querySelectorAll("audio");
    return a.paused && !b.paused;
  });
  await page.getByRole("button", { name: "Stop", exact: true }).last().click();

  const rate = await page.evaluate(async () => {
    const master = document.querySelectorAll("audio")[1].src;
    const bytes = await (await fetch(master)).arrayBuffer();
    return new DataView(bytes).getUint32(24, true);
  });
  await choose("Sample Rate", rate === 44100 ? "44.1 kHz" : "48 kHz");
  const wavCount = await page.evaluate(() => audioAudit.messages.filter((m) => m === "ENCODE_WAV").length);
  await download("Download review-tone.wav", "review-master-24.wav");
  check(await page.evaluate(() => audioAudit.messages.filter((m) => m === "ENCODE_WAV").length) === wavCount, "Matching WAV was re-encoded");
  await download("Download All", "review-master.zip");
  await choose("Sample Rate", "44.1 kHz");
  await choose("Bit Depth", "16-bit");
  await choose("Dither", "TPDF");
  await download("Download review-tone.wav", "review-master-16.wav");
  await choose("Format", "MP3");
  await download("Download review-tone.wav", "review-master.mp3");
  await download("Download All", "review-mp3.zip");

  // Re-mastering must release the previous large blob after React commits.
  const oldUrl = await page.evaluate(() => document.querySelectorAll("audio")[1].src);
  await start();
  await page.waitForFunction((url) => document.querySelectorAll("audio")[1].src !== url, oldUrl);
  await waitDone();
  check(await page.evaluate((url) => audioAudit.revoked.includes(url), oldUrl), "Previous master URL leaked");
  await page.screenshot({ path: "output/playwright/mastering-verified.png", fullPage: true });

  // A real client receives a synthetic render failure: do not normalize or export.
  await page.getByRole("button", { name: "Remove review-tone.wav", exact: true }).click();
  await upload("review-tone.wav");
  await page.getByRole("checkbox", { name: "Normalize Loudness", exact: true }).uncheck();
  await page.evaluate(() => { audioAudit.mode = "fail"; audioAudit.messages = []; });
  await start();
  await page.getByText("Injected render failure", { exact: true }).waitFor();
  check(!await page.getByRole("button", { name: "Download review-tone.wav", exact: true }).count(), "Failed master became downloadable");
  check(await page.evaluate(() => !audioAudit.messages.includes("NORMALIZE") && !audioAudit.messages.includes("ENCODE_WAV")), "Failed render triggered fallback or export");

  // Hold the render until the user cancels, then verify the client can restart.
  await page.evaluate(() => { audioAudit.mode = "hold"; audioAudit.messages = []; });
  await start();
  await page.waitForFunction(() => audioAudit.messages.includes("RENDER_FULL_CHAIN"));
  await page.getByRole("button", { name: "Stop", exact: true }).first().click();
  await page.getByRole("button", { name: "Start", exact: true }).waitFor();
  check(await page.evaluate(() => !audioAudit.messages.includes("NORMALIZE") && !audioAudit.messages.includes("ENCODE_WAV")), "Cancellation spawned more audio work");
  await page.evaluate(() => { audioAudit.mode = "normal"; });
  await start();
  await waitDone();
  await page.screenshot({ path: "output/playwright/cancel-restart-verified.png", fullPage: true });
}
