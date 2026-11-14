/** true — бэкенд работает прямо в браузере (Pyodide в Web Worker); false — FastAPI-сервер. */
export const BROWSER_RUNTIME = import.meta.env.VITE_RUNTIME === "browser";
