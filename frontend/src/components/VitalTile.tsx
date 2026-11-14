import { Activity, Droplets, Gauge as GaugeIcon, HeartPulse, Thermometer, type LucideIcon } from "lucide-react";
import { vitalMeta } from "../lib/format";
import type { Astronaut, HistoryPoint, Status } from "../lib/types";
import { Sparkline, StatusPill } from "./ui";

type Key = "hr" | "spo2" | "rr" | "sbp" | "temp";
const ICONS: Record<Key, LucideIcon> = { hr: HeartPulse, spo2: Droplets, rr: Activity, sbp: GaugeIcon, temp: Thermometer };
const MIN_SPAN: Record<Key, number> = { hr: 12, spo2: 4, rr: 6, sbp: 16, temp: 1 };
const valueColor: Record<Status, string> = { green: "text-fg", yellow: "text-warn", red: "text-crit" };

export function tileStatus(a: Astronaut, k: Key): { status: Status; note: string } {
  if (a.bad_metrics.includes(k)) return { status: "yellow", note: "нет данных с датчика" };
  const points = a.news2.parts[k] ?? 0;
  const z = a.z[k];
  if (k === "hr" && a.at_rest && z != null && z > 3) return { status: "yellow", note: "выше вашей нормы" };
  if (points >= 3) return { status: "red", note: "вне нормы" };
  if (points === 2) return { status: "yellow", note: "отклонение" };
  if (points === 1 && !(z != null && Math.abs(z) <= 2)) return { status: "yellow", note: "у границы нормы" };
  return { status: "green", note: "норма" };
}

export function VitalTile({ a, k, history }: { a: Astronaut; k: Key; history?: HistoryPoint[] }) {
  const meta = vitalMeta[k];
  const Icon = ICONS[k];
  const bad = a.bad_metrics.includes(k);
  const { status, note } = tileStatus(a, k);
  const base = a.baseline?.[k];
  return (
    <div className={`flex flex-col rounded-xl border bg-bg/60 p-4 ${status === "green" ? "border-line" : status === "yellow" ? "border-warn/50" : "border-crit/70"}`}>
      <div className="flex items-center gap-2 text-sm text-muted">
        <Icon aria-hidden className="h-4 w-4" />
        <span>{meta.label}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className={`num text-4xl font-semibold leading-none ${valueColor[status]}`}>{bad ? "—" : a.vitals[k]}</span>
        <span className="text-sm text-subtle">{meta.unit}</span>
      </div>
      {history && <Sparkline values={history.map((h) => h[k])} status={status} minSpan={MIN_SPAN[k]} className="mt-3 h-8 w-full" />}
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
        <StatusPill status={status} label={note} size="sm" />
      </div>
      <dl className="mt-2 space-y-0.5 text-xs text-subtle">
        <div className="flex justify-between gap-2"><dt>Ваша норма</dt><dd className="num text-muted">{base ? base.mean : "—"}</dd></div>
        <div className="flex justify-between gap-2"><dt>Общая норма</dt><dd className="num text-muted">{meta.normal}</dd></div>
      </dl>
    </div>
  );
}
