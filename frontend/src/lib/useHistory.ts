import { useEffect, useState } from "react";
import { api } from "./api";
import { useSnapshot } from "./snapshot";
import type { HistoryPoint } from "./types";

/** История показателей: начальная загрузка с бэкенда + новые точки из снимков WebSocket. */
export function useHistory(aid: string, windowMin = 30): HistoryPoint[] {
  const { onboard } = useSnapshot();
  const [points, setPoints] = useState<HistoryPoint[]>([]);

  useEffect(() => {
    let cancelled = false;
    api.get<HistoryPoint[]>(`/api/crew/${aid}/history?minutes=${windowMin}`)
      .then((h) => !cancelled && setPoints(h))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [aid, windowMin]);

  useEffect(() => {
    if (!onboard) return;
    const a = onboard.crew.find((c) => c.id === aid);
    if (!a) return;
    setPoints((prev) => {
      const last = prev[prev.length - 1];
      if (last && onboard.t - last.t < 1) return prev;
      const p: HistoryPoint = { t: onboard.t, ...a.vitals, news2: a.news2.total, readiness: a.readiness } as HistoryPoint;
      const since = onboard.t - windowMin * 60;
      return [...prev.filter((x) => x.t >= since && x.t < onboard.t), p];
    });
  }, [onboard, aid, windowMin]);

  return points;
}
