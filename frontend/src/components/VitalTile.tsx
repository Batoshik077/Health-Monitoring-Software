import { vitalMeta } from "../lib/format";
import type { Astronaut, Status } from "../lib/types";

const pointsStatus = (p: number): Status => (p >= 3 ? "red" : p >= 1 ? "yellow" : "green");
const color: Record<Status, string> = { green: "text-slate-100", yellow: "text-amber-300", red: "text-rose-400" };

export function VitalTile({ a, k }: { a: Astronaut; k: "hr" | "spo2" | "rr" | "sbp" | "temp" }) {
  const meta = vitalMeta[k];
  const value = a.vitals[k];
  const bad = a.bad_metrics.includes(k);
  const points = a.news2.parts[k] ?? 0;
  const z = a.z[k];
  const base = a.baseline?.[k];
  const offNorm = k === "hr" && a.at_rest && z != null && z > 3;
  const withinNorm = points === 1 && z != null && Math.abs(z) <= 2; // 1 балл, но это норма для этого человека
  const st: Status = bad ? "yellow" : offNorm ? "yellow" : pointsStatus(withinNorm ? 0 : points);
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
      <div className="text-xs text-slate-400">{meta.label}</div>
      <div className={`text-2xl font-bold tabular-nums ${color[st]}`}>
        {bad ? "—" : value}
        <span className="ml-1 text-xs font-normal text-slate-500">{meta.unit}</span>
      </div>
      <div className="mt-1 text-[11px] text-slate-500">
        {bad ? "нет данных с датчика" : (
          <>
            NEWS2: {points}
            {base && <> · ваша норма {base.mean}</>}
            {offNorm && <span className="text-amber-300"> · выше вашей нормы</span>}
          </>
        )}
      </div>
    </div>
  );
}
