import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

// Run the actual TS module with browser boundaries supplied by each test.
export function loadTs(url, { globals = {}, imports = {} } = {}) {
  const source = readFileSync(url, "utf8").replaceAll("import.meta.url", JSON.stringify(url.href));
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
  });
  const module = { exports: {} };
  const require = createRequire(url);
  vm.runInNewContext(outputText, {
    module, exports: module.exports, URL, Blob, Float32Array, Uint8Array, console,
    require: (name) => Object.hasOwn(imports, name) ? imports[name] : require(name),
    ...globals
  }, { filename: url.pathname });
  return module.exports;
}
