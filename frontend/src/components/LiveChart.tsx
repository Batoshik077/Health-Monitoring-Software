import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtDur } from "../lib/format";
import type { HistoryPoint } from "../lib/types";

interface Props {
  data: HistoryPoint[];
  metric: keyof HistoryPoint;
  label: string;
  unit: string;
  nowT: number;
  domain?: [number | "auto", number | "auto"];
  band?: { low: number; high: number; label: string };
  threshold?: { value: number; label: string };
}

const AXIS = { fontSize: 12, fill: "#a7b0bf", fontFamily: "JetBrains Mono Variable, monospace" };

export function LiveChart({ data, metric, label, unit, nowT, domain = ["auto", "auto"], band, threshold }: Props) {
  const values = data.map((d) => d[metric]).filter((v): v is number => typeof v === "number");
  const last = values[values.length - 1];
  const summary = values.length
    ? `${label}: сейчас ${last} ${unit}, за период от ${Math.min(...values)} до ${Math.max(...values)}`
    : `${label}: данных пока нет`;
  return (
    <figure className="min-w-0">
      <figcaption className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-sm font-medium text-fg">{label}, <span className="text-muted">{unit}</span></span>
        <span className="flex flex-wrap gap-3 text-xs text-subtle">
          {band && <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-4 rounded-sm bg-[#a7b0bf]/25" />{band.label}</span>}
          {threshold && <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-0 w-4 border-t-2 border-dashed border-crit" />{threshold.label}</span>}
        </span>
      </figcaption>
      <div className="h-44" role="img" aria-label={summary}>
        {values.length < 2 ? (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-line text-sm text-subtle">Копим данные…</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -12 }}>
              <CartesianGrid stroke="#2a3140" strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} tick={AXIS} tickCount={4} stroke="#2a3140"
                tickFormatter={(t: number) => (nowT - t < 1 ? "сейчас" : `−${fmtDur(nowT - t)}`)} />
              <YAxis domain={domain} tick={AXIS} width={44} stroke="#2a3140" tickCount={4} />
              {band && <ReferenceArea y1={band.low} y2={band.high} fill="#a7b0bf" fillOpacity={0.12} ifOverflow="extendDomain" />}
              {threshold && <ReferenceLine y={threshold.value} stroke="#f87171" strokeWidth={1.5} strokeDasharray="5 4" />}
              <Tooltip
                contentStyle={{ background: "#181d27", border: "1px solid #68748a", borderRadius: 12, fontSize: 13, color: "#eef2f7" }}
                labelStyle={{ color: "#a7b0bf" }}
                formatter={(v: number) => [`${v} ${unit}`, label]}
                labelFormatter={(t: number) => `${fmtDur(nowT - t)} назад`} />
              <Line type="monotone" dataKey={metric as string} stroke="#60a5fa" dot={false} strokeWidth={2.25}
                isAnimationActive={false} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </figure>
  );
}
