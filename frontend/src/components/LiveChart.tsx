import { Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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

export function LiveChart({ data, metric, label, unit, nowT, domain = ["auto", "auto"], band, threshold }: Props) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs text-slate-400">
        <span>{label}, {unit}</span>
        {band && <span className="text-slate-500">серая полоса — {band.label}</span>}
      </div>
      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} tick={{ fontSize: 10, fill: "#64748b" }}
              tickFormatter={(t: number) => `−${fmtDur(nowT - t)}`} />
            <YAxis domain={domain} tick={{ fontSize: 10, fill: "#64748b" }} />
            {band && <ReferenceArea y1={band.low} y2={band.high} fill="#94a3b8" fillOpacity={0.12} ifOverflow="extendDomain" />}
            {threshold && <ReferenceLine y={threshold.value} stroke="#f43f5e" strokeDasharray="4 4"
              label={{ value: threshold.label, fill: "#f43f5e", fontSize: 10, position: "insideTopRight" }} />}
            <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", fontSize: 12 }}
              labelFormatter={(t: number) => `${fmtDur(nowT - t)} назад`} />
            <Line type="monotone" dataKey={metric as string} stroke="#38bdf8" dot={false} strokeWidth={2}
              isAnimationActive={false} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
