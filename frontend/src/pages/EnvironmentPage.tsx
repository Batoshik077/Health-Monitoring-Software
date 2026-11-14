import { Droplets, Gauge, Radiation, Users, Wind } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { PageSkeleton, StatusIcon, StatusPill } from "../components/ui";
import { useSnapshot } from "../lib/snapshot";
import type { Module, Status } from "../lib/types";

function moduleStatus(m: Module): Status {
  if (m.co2_mmhg >= 6 || m.o2_pct < 17 || m.pressure_rate_per_min < -0.5 || m.dose_rate_msv_day > m.base_dose_rate * 5) return "red";
  if (m.co2_avg_1h > 3 || m.o2_pct < 19.5 || 101.3 - m.pressure_kpa > 2) return "yellow";
  return "green";
}

function Metric({ icon: Icon, label, value, unit, status, hint }: {
  icon: typeof Wind; label: string; value: string; unit: string; status: Status; hint: string;
}) {
  return (
    <div className="flex items-center gap-3 border-t border-line py-3 first:border-t-0 first:pt-0">
      <Icon aria-hidden className="h-5 w-5 shrink-0 text-subtle" />
      <div className="min-w-0 flex-1">
        <div className="text-sm text-muted">{label}</div>
        <div className="text-xs text-subtle">{hint}</div>
      </div>
      <div className="text-right">
        <span className={`num text-xl font-semibold ${status === "green" ? "text-fg" : status === "yellow" ? "text-warn" : "text-crit"}`}>{value}</span>
        <span className="ml-1 text-sm text-subtle">{unit}</span>
      </div>
      <StatusIcon status={status} className="h-4 w-4" />
    </div>
  );
}

export function ModulesGrid() {
  const { onboard } = useSnapshot();
  if (!onboard) return <PageSkeleton />;
  return (
    <ul className="grid gap-4 lg:grid-cols-3">
      {onboard.modules.map((m) => {
        const st = moduleStatus(m);
        const names = m.crew.map((id) => onboard.crew.find((c) => c.id === id)?.name ?? id);
        const co2: Status = m.co2_mmhg >= 6 ? "red" : m.co2_avg_1h > 3 ? "yellow" : "green";
        const o2: Status = m.o2_pct < 17 ? "red" : m.o2_pct < 19.5 ? "yellow" : "green";
        const pr: Status = m.pressure_rate_per_min < -0.5 ? "red" : 101.3 - m.pressure_kpa > 2 ? "yellow" : "green";
        const rad: Status = m.dose_rate_msv_day > m.base_dose_rate * 5 ? "red" : "green";
        return (
          <li key={m.id} className={`rounded-2xl border bg-surface/90 p-5 ${st === "green" ? "border-line" : st === "yellow" ? "border-warn/50" : "border-crit/70 pulse-critical"}`}>
            <div className="mb-4 flex items-center gap-2">
              <h3 className="flex-1 text-lg font-semibold">{m.name}</h3>
              <StatusPill status={st} size="sm" />
            </div>
            <Metric icon={Wind} label="CO₂ за час" hint={`сейчас ${m.co2_mmhg.toFixed(1)} · норма ≤ 3`} value={m.co2_avg_1h.toFixed(1)} unit="мм рт. ст." status={co2} />
            <Metric icon={Droplets} label="Кислород" hint="норма ≈ 21" value={m.o2_pct.toFixed(1)} unit="%" status={o2} />
            <Metric icon={Gauge} label="Давление" hint={`изменение ${m.pressure_rate_per_min.toFixed(2)} кПа/мин`} value={m.pressure_kpa.toFixed(1)} unit="кПа" status={pr} />
            <Metric icon={Radiation} label="Радиация" hint={`обычно ${m.base_dose_rate}`} value={m.dose_rate_msv_day.toFixed(2)} unit="мЗв/сут" status={rad} />
            <p className="mt-3 flex items-center gap-2 border-t border-line pt-3 text-sm text-muted">
              <Users aria-hidden className="h-4 w-4" />{names.length ? names.join(", ") : "в модуле никого нет"}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

export function EnvironmentPage() {
  return (
    <>
      <PageHeader eyebrow="Борт" title="Корабль">
        Норма CO₂ — в среднем за час не выше 3 мм рт. ст. (NASA-STD-3001). Радиация на перелёте к Марсу ≈ 1.8 мЗв/сут (Curiosity RAD).
      </PageHeader>
      <ModulesGrid />
    </>
  );
}
