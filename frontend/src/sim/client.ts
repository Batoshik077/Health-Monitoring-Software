import type { GroundSnapshot, OnboardSnapshot } from "../lib/types";

export interface SimState {
  onboard: OnboardSnapshot | null;
  ground: GroundSnapshot | null;
  ready: boolean;
  stage: string;
  error: string | null;
}

type Listener = (s: SimState) => void;

/** Клиент Web Worker'а с симуляцией. Один на вкладку. */
class SimClient {
  private worker: Worker;
  private nextId = 1;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private listeners = new Set<Listener>();
  state: SimState = { onboard: null, ground: null, ready: false, stage: "Подготовка…", error: null };

  constructor() {
    this.worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (e: MessageEvent) => {
      const m = e.data;
      if (m.type === "response") {
        const p = this.pending.get(m.id);
        if (!p) return;
        this.pending.delete(m.id);
        const { status, body } = JSON.parse(m.data);
        if (status >= 400) p.reject(new Error(body?.detail ?? `Ошибка ${status}`));
        else p.resolve(body);
      } else if (m.type === "snapshot") {
        const { onboard, ground } = JSON.parse(m.data);
        this.set({ onboard, ground });
      } else if (m.type === "boot") {
        this.set({ stage: m.stage });
      } else if (m.type === "ready") {
        this.set({ ready: true, error: null });
      } else if (m.type === "error") {
        this.set({ error: m.message });
      }
    };
    this.worker.onerror = (e) => this.set({ error: `Ошибка симуляции: ${e.message}` });
  }

  private set(patch: Partial<SimState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l(this.state));
  }

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    l(this.state);
    return () => this.listeners.delete(l);
  }

  request<T>(method: string, url: string, body?: unknown): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      this.worker.postMessage({ type: "request", id, method, url, body: body === undefined ? "" : JSON.stringify(body) });
    });
  }
}

let client: SimClient | null = null;
export function sim(): SimClient {
  client ??= new SimClient();
  return client;
}
