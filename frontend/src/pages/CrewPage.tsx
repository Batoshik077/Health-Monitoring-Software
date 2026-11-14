import { Building2, ChevronRight, Dumbbell, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { ModulesGrid } from "../components/ModulesGrid";
import { PageHeader } from "../components/PageHeader";
import { PageSkeleton, PanelTitle, StatusPill } from "../components/ui";
import { readinessStatus, roleLabel, statusTone } from "../lib/format";
import { useSnapshot } from "../lib/snapshot";

function Stat({ label, value, unit, tone = "text-fg" }: { label: string; value: string | number; unit?: string; tone?: string }) {
  return (
    <div>
      <dt className="text-xs text-subtle">{label}</dt>
      <dd className={`num text-2xl font-semibold ${tone}`}>{value}{unit && <span className="ml-0.5 text-sm font-normal text-subtle">{unit}</span>}</dd>
    </div>
  );
}

/** Экипаж и корабль: кому нужно внимание + среда в модулях. Карточка ведёт на экран астронавта («Моё здоровье»). */
export function CrewPage() {
  const { onboard } = useSnapshot();
  if (!onboard) return <PageSkeleton />;
  const order = { red: 0, yellow: 1, green: 2 } as const;
  const crew = [...onboard.crew].sort((a, b) => order[a.status] - order[b.status]);
  return (
    <div className="page">
      <PageHeader eyebrow="Для медика и командира" title="Экипаж и корабль">Сначала те, кому нужно внимание.</PageHeader>
      <section aria-labelledby="crew-title">
        <PanelTitle id="crew-title" icon={Users}>Экипаж</PanelTitle>
        <ul className="stagger grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          {crew.map((a) => {
            const rs = readinessStatus(a.readiness);
            return (
              <li key={a.id}>
                <Link to={`/me/${a.id}`}
                  className={`card card-link group flex h-full flex-col rounded-2xl border p-5 ${a.status === "green" ? "border-white/[0.07]" : statusTone[a.status].border} ${a.status === "red" ? "pulse-critical" : ""}`}>
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-xl font-semibold">{a.name}</h2>
                      <p className="text-sm text-muted">{roleLabel[a.role] ?? a.role}</p>
                    </div>
                    <StatusPill status={a.status} size="sm" />
                  </div>
                  <dl className="mt-4 grid grid-cols-3 gap-3">
                    <Stat label="Пульс" value={a.quality_ok ? a.vitals.hr ?? "—" : "—"} />
                    <Stat label="SpO₂" value={a.quality_ok ? a.vitals.spo2 ?? "—" : "—"} unit="%" />
                    <Stat label="Готовность" value={a.readiness} tone={statusTone[rs].text} />
                  </dl>
                  <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/5 pt-3 text-sm text-muted">
                    <span>NEWS2 <span className="num text-fg">{a.news2.total}</span></span>
                    <span className="inline-flex items-center gap-1"><Building2 aria-hidden className="h-4 w-4" />{onboard.modules.find((m) => m.id === a.module)?.name}</span>
                    {!a.at_rest && <span className="inline-flex items-center gap-1 text-accent"><Dumbbell aria-hidden className="h-4 w-4" />тренировка</span>}
                    <ChevronRight aria-hidden className="ml-auto h-5 w-5 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-fg" />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
      <section id="modules" className="mt-8 scroll-mt-20" aria-labelledby="modules-title">
        <PanelTitle id="modules-title" icon={Building2}
          aside={<span className="text-xs text-subtle">норма CO₂ ≤ 3 мм рт. ст. за час (NASA-STD-3001)</span>}>
          Модули корабля
        </PanelTitle>
        <ModulesGrid />
      </section>
    </div>
  );
}
