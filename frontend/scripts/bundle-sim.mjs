// Готовит браузерную версию симуляции (Pyodide):
//  - public/sim/bundle.json — Python-код бэкенда (без FastAPI) и конфиги (YAML → JSON)
//  - public/pyodide/        — сам Pyodide из npm, чтобы не зависеть от CDN
import { copyFileSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const here = dirname(fileURLToPath(import.meta.url));
const front = join(here, "..");
const root = join(front, "..");

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? (name === "__pycache__" ? [] : walk(p)) : [p];
  });
}

const files = {};
for (const p of walk(join(root, "backend", "app"))) {
  const rel = relative(root, p).split("\\").join("/");
  if (!rel.endsWith(".py") || rel === "backend/app/main.py") continue; // FastAPI-сервер в браузере не нужен
  files[rel] = readFileSync(p, "utf8");
}
for (const p of walk(join(root, "config"))) {
  const rel = relative(root, p).split("\\").join("/");
  if (!rel.endsWith(".yaml")) continue;
  files[rel] = JSON.stringify(yaml.load(readFileSync(p, "utf8"))); // JSON — подмножество YAML
}

mkdirSync(join(front, "public", "sim"), { recursive: true });
writeFileSync(join(front, "public", "sim", "bundle.json"), JSON.stringify({ files }));

const pyo = join(front, "node_modules", "pyodide");
mkdirSync(join(front, "public", "pyodide"), { recursive: true });
for (const f of ["pyodide.mjs", "pyodide.asm.mjs", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"]) {
  copyFileSync(join(pyo, f), join(front, "public", "pyodide", f));
}
console.log(`sim bundle: ${Object.keys(files).length} files; pyodide copied`);
