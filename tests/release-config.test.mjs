import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("package and extension manifest versions stay aligned", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const manifest = JSON.parse(await readFile(new URL("../src/extension/manifest.json", import.meta.url), "utf8"));
  assert.equal(manifest.version, packageJson.version);
});

test("documented build commands exist", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  for (const script of ["build", "typecheck", "test", "build:ext"]) {
    assert.equal(typeof packageJson.scripts[script], "string", `missing script: ${script}`);
  }
});
