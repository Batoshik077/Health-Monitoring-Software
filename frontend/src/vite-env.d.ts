/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "browser" — симуляция работает в браузере (Pyodide), без сервера. Иначе — FastAPI-бэкенд. */
  readonly VITE_RUNTIME?: string;
}
