import { ArrowLeft, Bone, LineChart as ChartIcon, Moon, OctagonAlert, Radiation } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { AlertRow } from "../components/AlertRow";
import { LiveChart } from "../components/LiveChart";
import { EmptyState, PageSkeleton, Panel, PanelTitle, StatusPill } from "../components/ui";
import { useSnapshot } from "../lib/snapshot";
import { useHistory } from "../lib/useHistory";
import { MeView } from "./MePage";

/** Карточка астронавта для медика: всё из «Моё здоровье» + графики и история. */
export function AstronautPage() {
  const { id = "a1" } = useParams();
  const { onboard } = useSnapshot();
  const windowMin = onboard && onboard.speed >= 60 ? 360 : 30;
  const history = useHistory(id, windowMin);
  if (!onboard) return <PageSkeleton />;
  const a = onboard.crew.find((c) => c.id === id);
  if (!a) return <EmptyState title="Нет такого астронавта" />;
  const band = (k: string) => a.baseline[k] && {
    low: +(a.baseline[k].mean - 2 * a.baseline[k].std).toFixed(1),
    high: +(a.baseline[k].mean + 2 * a.baseline[k].std).toFixed(1),
    label: "личная норма",
  };
  const alerts = onboard.alerts.filter((al) => al.subject_id === a.id);
  const dosePct = a.dose.pct_limit;
  return (
    <div className="space-y-5">
      <Link to="/crew" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted hover:text-fg">
        <ArrowLeft aria-hidden className="h-4 w-4" /> Весь экипаж
      </Link>
      <MeView id={id} compact />
      <Panel labelledBy="charts-title">
        <PanelTitle id="charts-title" icon={ChartIcon}>Графики за {windowMin >= 60 ? `${windowMin / 60} ч` : `${windowMin} мин`}</PanelTitle>
        <div className="grid gap-6 lg:grid-cols-2">
          <LiveChart data={history} metric="hr" label="Пульс" unit="уд/мин" nowT={onboard.t} band={band("hr") || undefined} />
          <LiveChart data={history} metric="spo2" label="SpO₂" unit="%" nowT={onboard.t} domain={[80, 100]}
            threshold={{ value: 88, label: "критический порог 88 %" }} />
          <LiveChart data={history} metric="rr" label="Частота дыхания" unit="/мин" nowT={onboard.t} band={band("rr") || undefined} />
          <LiveChart data={history} metric="readiness" label="Индекс готовности" unit="из 100" nowT={onboard.t} domain={[0, 100]} />
        </div>
      </Panel>
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel labelledBy="sleep-title">
          <PanelTitle id="sleep-title" icon={Moon}>Сон, последние ночи</PanelTitle>
          <ul className="flex h-32 items-end gap-2" aria-label="Длительность сна по ночам, часов">
            {a.sleep.map((s, i) => (
              <li key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
                <span className="num text-xs text-muted">{s}</span>
                <div className={`w-full rounded-t-md ${s < 6 ? "bg-warn" : "bg-accent/70"}`} style={{ height: `${(s / 9) * 88}px` }}
                  aria-hidden />
                <span className="sr-only">{s} ч{s < 6 ? ", меньше нормы" : ""}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-subtle">План NASA — 8.5 ч; на МКС в среднем ~6 ч. Жёлтым — меньше 6 ч.</p>
        </Panel>
        <Panel labelledBy="bone-title">
          <PanelTitle id="bone-title" icon={Bone}>Тренировки и кости</PanelTitle>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm"><span className="text-muted">Сегодня</span><span className="num">{a.exercise.today} / {a.exercise.plan_per_day} мин</span></div>
              <div className="mt-1.5 h-2 rounded-full bg-line"><div className="h-2 rounded-full bg-accent" style={{ width: `${Math.min(100, (a.exercise.today / a.exercise.plan_per_day) * 100)}%` }} /></div>
            </div>
            <div>
              <div className="flex justify-between text-sm"><span className="text-muted">За 7 дней</span><span className="num">{a.exercise.last_7d} / {a.exercise.plan_per_day * 7} мин</span></div>
              <div className="mt-1.5 h-2 rounded-full bg-line"><div className="h-2 rounded-full bg-accent" style={{ width: `${Math.min(100, (a.exercise.last_7d / (a.exercise.plan_per_day * 7)) * 100)}%` }} /></div>
            </div>
            <div className="flex justify-between border-t border-line pt-3 text-sm"><span className="text-muted">Оценка потери плотности костей</span><span className="num font-semibold">~{a.bone_loss_est_pct} %</span></div>
          </div>
          <p className="mt-2 text-sm text-subtle">Грубая оценка: ~1 % в месяц (NASA: 1–1.5 %), не измерение.</p>
        </Panel>
        <Panel labelledBy="rad-title">
          <PanelTitle id="rad-title" icon={Radiation}>Радиация</PanelTitle>
          <p className="num text-3xl font-semibold">{a.dose.msv}<span className="ml-1 text-base font-normal text-subtle">мЗв</span></p>
          <div className="mt-3 h-2 rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={dosePct}
            aria-label="Доля карьерного лимита 600 мЗв">
            <div className={`h-2 rounded-full ${dosePct >= 80 ? "bg-crit" : dosePct >= 50 ? "bg-warn" : "bg-ok"}`} style={{ width: `${Math.min(100, dosePct)}%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-sm">
            <span className="text-muted"><span className="num text-fg">{dosePct} %</span> лимита 600 мЗв</span>
            <StatusPill status={dosePct >= 80 ? "red" : dosePct >= 50 ? "yellow" : "green"} size="sm" />
          </div>
          <p className="mt-2 text-sm text-subtle">Сейчас: <span className="num">{a.dose.rate_msv_day}</span> мЗв/сут</p>
        </Panel>
      </div>
      <Panel labelledBy="astro-alerts">
        <PanelTitle id="astro-alerts" icon={OctagonAlert}>Тревоги астронавта</PanelTitle>
        {alerts.length === 0 ? <EmptyState title="Тревог не было" /> : <div className="space-y-2">{alerts.map((al) => <AlertRow key={al.id} alert={al} nowT={onboard.t} />)}</div>}
      </Panel>
    </div>
  );
}
