import { Link } from "react-router-dom";
import { Big, Card, Dot, Loading, SectionTitle } from "../components/ui";
import { roleLabel } from "../lib/format";
import { useSnapshot } from "../lib/snapshot";
import { ModulesGrid } from "./EnvironmentPage";

/** Обзор экипажа для бортового медика и командира. */
export function CrewPage() {
  const { onboard } = useSnapshot();
  if (!onboard) return <Loading />;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {onboard.crew.map((a) => (
          <Link key={a.id} to={`/crew/${a.id}`} className="block hover:brightness-125">
            <Card status={a.status} pulse={a.status === "red"}>
              <div className="flex items-center gap-2">
                <Dot status={a.status} />
                <div className="font-semibold">{a.name}</div>
                <div className="ml-auto text-xs text-slate-400">{roleLabel[a.role] ?? a.role}</div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div><div className="text-[11px] text-slate-400">Пульс</div><Big value={a.quality_ok ? a.vitals.hr : "—"} /></div>
                <div><div className="text-[11px] text-slate-400">SpO₂</div><Big value={a.quality_ok ? a.vitals.spo2 : "—"} /></div>
                <div><div className="text-[11px] text-slate-400">Готовность</div><Big value={a.readiness} /></div>
              </div>
              <div className="mt-2 flex justify-between text-xs text-slate-400">
                <span>NEWS2: {a.news2.total}</span>
                <span>{onboard.modules.find((m) => m.id === a.module)?.name}</span>
                {!a.at_rest && <span className="text-sky-300">тренировка</span>}
              </div>
            </Card>
          </Link>
        ))}
      </div>
      <div>
        <SectionTitle>Модули корабля</SectionTitle>
        <ModulesGrid />
      </div>
    </div>
  );
}
