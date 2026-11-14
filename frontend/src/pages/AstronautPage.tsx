import { useParams } from "react-router-dom";
import { AlertRow } from "../components/AlertRow";
import { LiveChart } from "../components/LiveChart";
import { Card, Empty, Loading, SectionTitle } from "../components/ui";
import { useSnapshot } from "../lib/snapshot";
import { useHistory } from "../lib/useHistory";
import { MeView } from "./MePage";

/** Карточка астронавта для медика: всё из «Моё здоровье» + графики и история. */
export function AstronautPage() {
  const { id = "a1" } = useParams();
  const { onboard } = useSnapshot();
  const windowMin = onboard && onboard.speed >= 60 ? 360 : 30;
  const history = useHistory(id, windowMin);
  if (!onboard) return <Loading />;
  const a = onboard.crew.find((c) => c.id === id);
  if (!a) return <Empty>Нет астронавта</Empty>;
  const band = (k: string) => a.baseline[k] && {
    low: a.baseline[k].mean - 2 * a.baseline[k].std, high: a.baseline[k].mean + 2 * a.baseline[k].std, label: "личная норма",
  };
  const alerts = onboard.alerts.filter((al) => al.subject_id === a.id);
  return (
    <div className="space-y-4">
      <MeView id={id} compact />
      <Card>
        <SectionTitle>Графики за {windowMin >= 60 ? `${windowMin / 60} ч` : `${windowMin} мин`}</SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">
          <LiveChart data={history} metric="hr" label="Пульс" unit="уд/мин" nowT={onboard.t} band={band("hr") || undefined} />
          <LiveChart data={history} metric="spo2" label="SpO₂" unit="%" nowT={onboard.t} domain={[80, 100]}
            threshold={{ value: 88, label: "критично" }} />
          <LiveChart data={history} metric="rr" label="Дыхание" unit="/мин" nowT={onboard.t} band={band("rr") || undefined} />
          <LiveChart data={history} metric="readiness" label="Индекс готовности" unit="/100" nowT={onboard.t} domain={[0, 100]} />
        </div>
      </Card>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <SectionTitle>Сон, последние ночи</SectionTitle>
          <div className="flex h-24 items-end gap-2">
            {a.sleep.map((s, i) => (
              <div key={i} className="flex flex-1 flex-col items-center">
                <div className={`w-full rounded-t ${s < 6 ? "bg-amber-400" : "bg-sky-500"}`} style={{ height: `${(s / 9) * 80}px` }} />
                <span className="text-[10px] text-slate-400">{s}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">План NASA — 8.5 ч; на МКС в среднем ~6 ч.</p>
        </Card>
        <Card>
          <SectionTitle>Тренировки и кости</SectionTitle>
          <div className="text-sm">Сегодня: <b>{a.exercise.today}</b> из {a.exercise.plan_per_day} мин</div>
          <div className="text-sm">За 7 дней: <b>{a.exercise.last_7d}</b> из {a.exercise.plan_per_day * 7} мин</div>
          <div className="mt-2 text-sm">Оценка потери плотности костей: <b>~{a.bone_loss_est_pct} %</b></div>
          <p className="mt-1 text-xs text-slate-500">Грубая оценка: ~1 % в месяц (NASA: 1–1.5 %), не измерение.</p>
        </Card>
        <Card>
          <SectionTitle>Радиация</SectionTitle>
          <div className="text-sm">Накоплено: <b>{a.dose.msv} мЗв</b> ({a.dose.pct_limit} % лимита 600 мЗв)</div>
          <div className="mt-2 h-2 rounded bg-slate-800">
            <div className={`h-2 rounded ${a.dose.pct_limit >= 80 ? "bg-rose-500" : a.dose.pct_limit >= 50 ? "bg-amber-400" : "bg-emerald-500"}`}
              style={{ width: `${Math.min(100, a.dose.pct_limit)}%` }} />
          </div>
          <div className="mt-2 text-sm">Сейчас: {a.dose.rate_msv_day} мЗв/сут</div>
        </Card>
      </div>
      <Card>
        <SectionTitle>Тревоги астронавта</SectionTitle>
        {alerts.length === 0 ? <Empty>Нет</Empty> : <div className="space-y-2">{alerts.map((al) => <AlertRow key={al.id} alert={al} nowT={onboard.t} />)}</div>}
      </Card>
    </div>
  );
}
