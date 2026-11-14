import { Card, Loading, SectionTitle } from "../components/ui";
import { useSnapshot } from "../lib/snapshot";
import type { Module, Status } from "../lib/types";

function moduleStatus(m: Module): Status {
  if (m.co2_mmhg >= 6 || m.o2_pct < 17 || m.pressure_rate_per_min < -0.5 || m.dose_rate_msv_day > m.base_dose_rate * 5) return "red";
  if (m.co2_avg_1h > 3 || m.o2_pct < 19.5 || 101.3 - m.pressure_kpa > 2) return "yellow";
  return "green";
}

function Row({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-400">{label}</span>
      <span className={`tabular-nums ${warn ? "font-semibold text-amber-300" : ""}`}>{value}</span>
    </div>
  );
}

export function ModulesGrid() {
  const { onboard } = useSnapshot();
  if (!onboard) return <Loading />;
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {onboard.modules.map((m) => {
        const st = moduleStatus(m);
        const names = m.crew.map((id) => onboard.crew.find((c) => c.id === id)?.name ?? id);
        return (
          <Card key={m.id} status={st} pulse={st === "red"}>
            <div className="mb-2 font-semibold">{m.name}</div>
            <div className="space-y-1">
              <Row label="CO₂ сейчас / за час" value={`${m.co2_mmhg.toFixed(1)} / ${m.co2_avg_1h.toFixed(1)} мм рт. ст.`} warn={m.co2_avg_1h > 3} />
              <Row label="O₂" value={`${m.o2_pct.toFixed(1)} %`} warn={m.o2_pct < 19.5} />
              <Row label="Давление" value={`${m.pressure_kpa.toFixed(1)} кПа`} warn={101.3 - m.pressure_kpa > 2} />
              <Row label="Радиация" value={`${m.dose_rate_msv_day.toFixed(2)} мЗв/сут`} warn={m.dose_rate_msv_day > m.base_dose_rate * 5} />
              <Row label="Экипаж" value={names.length ? names.join(", ") : "никого"} />
            </div>
          </Card>
        );
      })}
    </div>
  );
}

export function EnvironmentPage() {
  return (
    <div>
      <SectionTitle>Среда на борту</SectionTitle>
      <ModulesGrid />
      <p className="mt-3 text-xs text-slate-500">
        Норма CO₂: в среднем за час не выше 3 мм рт. ст. (NASA-STD-3001). Радиация на перелёте к Марсу ≈ 1.8 мЗв/сут (Curiosity RAD).
      </p>
    </div>
  );
}
