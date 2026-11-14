import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { sim } from "../sim/client";
import { BROWSER_RUNTIME } from "./runtime";
import type { GroundSnapshot, OnboardSnapshot } from "./types";

function useSocket<T>(path: string): { data: T | null; connected: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [connected, setConnected] = useState(false);
  const retry = useRef(0);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout>;
    let closed = false;

    const connect = () => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      ws = new WebSocket(`${proto}://${location.host}${path}`);
      ws.onopen = () => {
        retry.current = 0;
        setConnected(true);
      };
      ws.onmessage = (e) => setData(JSON.parse(e.data) as T);
      ws.onclose = () => {
        setConnected(false);
        if (!closed) timer = setTimeout(connect, Math.min(5000, 500 * 2 ** retry.current++));
      };
    };
    connect();
    return () => {
      closed = true;
      clearTimeout(timer);
      ws?.close();
    };
  }, [path]);

  return { data, connected };
}

interface Ctx {
  onboard: OnboardSnapshot | null;
  ground: GroundSnapshot | null;
  connected: boolean;
  /** Только для браузерного режима: этап запуска и ошибка */
  boot: { stage: string; error: string | null } | null;
}

const SnapshotContext = createContext<Ctx>({ onboard: null, ground: null, connected: false, boot: null });

function ServerProvider({ children }: { children: ReactNode }) {
  const onboard = useSocket<OnboardSnapshot>("/ws/onboard");
  const ground = useSocket<GroundSnapshot>("/ws/ground");
  return (
    <SnapshotContext.Provider value={{ onboard: onboard.data, ground: ground.data, connected: onboard.connected, boot: null }}>
      {children}
    </SnapshotContext.Provider>
  );
}

function BrowserProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState(sim().state);
  useEffect(() => sim().subscribe(setS), []);
  return (
    <SnapshotContext.Provider value={{ onboard: s.onboard, ground: s.ground, connected: s.ready, boot: { stage: s.stage, error: s.error } }}>
      {children}
    </SnapshotContext.Provider>
  );
}

export function SnapshotProvider({ children }: { children: ReactNode }) {
  return BROWSER_RUNTIME ? <BrowserProvider>{children}</BrowserProvider> : <ServerProvider>{children}</ServerProvider>;
}

export const useSnapshot = () => useContext(SnapshotContext);
