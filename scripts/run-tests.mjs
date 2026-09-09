import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Node 20 on Windows does not expand test-file globs. Enumerate explicitly so
// the same test suite runs under the supported runtime and newer Node versions.
const testsDirectory = new URL("../tests/", import.meta.url);
const files = readdirSync(testsDirectory).filter((name) => name.endsWith(".test.mjs")).sort();
if (files.length === 0) throw new Error("No test files found");
const result = spawnSync(process.execPath, [
  "--test", ...files.map((name) => fileURLToPath(new URL(name, testsDirectory)))
], { stdio: "inherit" });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
