/// <reference lib="webworker" />
// Бортовая система целиком в браузере: тот же Python-код бэкенда, запущенный в Pyodide.
// Сообщения: request → response; каждые 250 мс — snapshot; при запуске — boot / error.

type PyApp = {
  tick: (dt: number) => void;
  snapshots: () => string;
  request: (method: string, url: string, body: string) => string;
};
type Incoming = { type: "request"; id: number; method: string; url: string; body?: string };

const scope = self as unknown as DedicatedWorkerGlobalScope;
const base = import.meta.env.BASE_URL;
const ROOT = "/home/pyodide/astro";
const TICK_MS = 250;

let app: PyApp | null = null;
const queue: Incoming[] = [];

function handle(msg: Incoming) {
  if (!app) return queue.push(msg);
  let data: string;
  try {
    data = app.request(msg.method, msg.url, msg.body ?? "");
  } catch (e) {
    data = JSON.stringify({ status: 500, body: { detail: String(e) } });
  }
  scope.postMessage({ type: "response", id: msg.id, data });
}

scope.onmessage = (e: MessageEvent<Incoming>) => {
  if (e.data?.type === "request") handle(e.data);
};

async function boot() {
  try {
    scope.postMessage({ type: "boot", stage: "Загружаем Python (WebAssembly)…" });
    const { loadPyodide } = await import(/* @vite-ignore */ `${base}pyodide/pyodide.mjs`);
    const pyodide = await loadPyodide({ indexURL: `${base}pyodide/` });

    scope.postMessage({ type: "boot", stage: "Загружаем код бортовой системы…" });
    const bundle: { files: Record<string, string> } = await (await fetch(`${base}sim/bundle.json`)).json();
    for (const [path, content] of Object.entries(bundle.files)) {
      const full = `${ROOT}/${path}`;
      pyodide.FS.mkdirTree(full.slice(0, full.lastIndexOf("/")));
      pyodide.FS.writeFile(full, content);
    }

    scope.postMessage({ type: "boot", stage: "Запускаем симуляцию миссии…" });
    pyodide.runPython(`import sys\nsys.path.insert(0, "${ROOT}/backend")`);
    app = pyodide.runPython("from app.local_api import LocalApp\nLocalApp()") as PyApp;

    let last = performance.now();
    const loop = () => {
      const now = performance.now();
      try {
        app!.tick((now - last) / 1000);
        scope.postMessage({ type: "snapshot", data: app!.snapshots() });
      } catch (e) {
        scope.postMessage({ type: "error", message: String(e) });
      }
      last = now;
    };
    loop();
    setInterval(loop, TICK_MS);
    scope.postMessage({ type: "ready" });
    queue.splice(0).forEach(handle);
  } catch (e) {
    scope.postMessage({ type: "error", message: `Не удалось запустить симуляцию: ${String(e)}` });
  }
}

boot();
