import {
  Bone, ChevronRight, ClipboardCheck, Dumbbell, FlaskConical, HeartPulse, ListChecks, MessageSquare, Moon,
  Radiation, Star, Stethoscope, User, Wrench, type LucideIcon,
} from "lucide-react";
import { lazy, Suspense } from "react";
import { Link, useParams } from "react-router-dom";
import { EmptyState, Gauge, PageSkeleton, Panel, PanelTitle, Skeleton, StatusIcon, StatusPill } from "../components/ui";
import { BodyMap } from "../components/BodyMap";
import { VitalTile } from "../components/VitalTile";
import { fmtDur, readinessStatus, roleLabel, statusTone } from "../lib/format";
import { useSnapshot } from "../lib/snapshot";
import type { Astronaut, Todo } from "../lib/types";
import { useHistory } from "../lib/useHistory";

// графики (recharts) — отдельным чанком, грузятся после основного экрана
const TrendsPanel = lazy(() => import("../components/TrendsPanel"));

const TODO_ICONS: Record<Todo["kind"], LucideIcon> = { protocol: ListChecks, checkin: ClipboardCheck, exercise: Dumbbell, sleep: Moon };
const ROLE_ICONS: Record<string, LucideIcon> = { commander: Star, cmo: Stethoscope, engineer: Wrench, scientist: FlaskConical };
const VITALS = ["hr", "spo2", "rr", "sbp", "temp"] as const;
const SPARK_MIN = 10; // мини-графики в плитках — последние 10 минут

/** Переключатель астронавта: одна строка вкладок с подсветкой активного. */
function CrewSwitch({ current }: { current: string }) {
  const { onboard } = useSnapshot();
  if (!onboard) return null;
  return (
    <nav aria-label="Выбор астронавта" className="flex flex-wrap gap-1 rounded-2xl border border-white/[0.07] bg-black/20 p-1 backdrop-blur sm:inline-flex">
      {onboard.crew.map((c) => {
        const active = c.id === current;
        const Icon = ROLE_ICONS[c.role] ?? User;
        return (
          <Link key={c.id} to={`/me/${c.id}`} aria-current={active ? "page" : undefined}
            className={`relative inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-all duration-300 sm:flex-none ${active
              ? "bg-accent-strong text-white shadow-[0_6px_20px_-8px_rgb(37_99_235/0.9)]"
              : "text-muted hover:bg-white/[0.04] hover:text-fg"}`}>
            <Icon aria-hidden className="h-4 w-4" />
            {c.name}
            {c.status !== "green" && <StatusIcon status={c.status} className="h-4 w-4" />}
          </Link>
        );
      })}
    </nav>
  );
}

function Hero({ a }: { a: Astronaut }) {
  const { onboard } = useSnapshot();
  const moduleName = onboard?.modules.find((m) => m.id === a.module)?.name ?? a.module;
  const rs = readinessStatus(a.readiness);
  const Icon = ROLE_ICONS[a.role] ?? User;
  return (
    <Panel as="div" className="hero-card relative overflow-hidden">
      <div aria-hidden className="hero-orbit hidden sm:block" />
      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <span className={`hidden h-16 w-16 shrink-0 items-center justify-center rounded-2xl border sm:flex ${statusTone[a.status].bg} ${a.status === "green" ? "border-ok/30" : statusTone[a.status].border}`}>
            <Icon aria-hidden className={`h-8 w-8 ${statusTone[a.status].text}`} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="title-gradient text-3xl font-semibold tracking-tight sm:text-4xl">{a.name}</h1>
              <StatusPill status={a.status} label={`Состояние: ${statusTone[a.status].label.toLowerCase()}`} />
            </div>
            <p className="mt-2 text-[15px] text-muted">
              {roleLabel[a.role] ?? a.role} · {moduleName} · день миссии <span className="num text-fg">{a.mission_day}</span>
              {!a.at_rest && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-sm text-accent">
                  <Dumbbell aria-hidden className="h-3.5 w-3.5" />идёт тренировка
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Gauge value={a.readiness} status={rs} label="Индекс готовности" />
          <div>
            <p className="text-sm text-muted">Индекс готовности</p>
            <StatusPill status={rs} label={rs === "green" ? "готов к работе" : rs === "yellow" ? "снижен" : "низкий"} size="sm" />
          </div>
        </div>
      </div>
    </Panel>
  );
}

/** Единственный список дел: самопроверка, протоколы тревог, тренировка, сон — всё здесь, без дублей в шапке. */
function TodoPanel({ a }: { a: Astronaut }) {
  return (
    <Panel className="xl:col-span-4" labelledBy={`todo-${a.id}`}>
      <PanelTitle id={`todo-${a.id}`} icon={ListChecks}
        aside={a.todo.length > 0 && <span className="num rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">{a.todo.length}</span>}>
        Что сделать сейчас
      </PanelTitle>
      {a.todo.length === 0 ? <EmptyState title="Всё сделано">Новых дел нет. Система подскажет, если что-то изменится.</EmptyState> : (
        <ul className="stagger space-y-2">
          {a.todo.map((t, i) => {
            const Icon = TODO_ICONS[t.kind];
            const href = t.kind === "protocol" ? `/alerts/${t.alert_id}` : t.kind === "checkin" ? `/me/${a.id}/checkin` : null;
            const urgent = t.kind === "protocol";
            const inner = (
              <>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${urgent ? "bg-crit/15 text-crit" : "bg-accent/15 text-accent"}`}>
                  <Icon aria-hidden className="h-[18px] w-[18px]" />
                </span>
                <span className="flex-1">{t.text}</span>
                {href && <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5" />}
              </>
            );
            const cls = `group flex min-h-14 items-center gap-3 rounded-xl border px-3 py-2.5 text-[15px] ${urgent ? "border-crit/60 bg-crit/[0.08]" : "border-white/[0.06] bg-white/[0.025]"}`;
            return (
              <li key={i}>
                {href
                  ? <Link to={href} className={`${cls} transition-[border-color,background-color,transform] duration-200 hover:-translate-y-px hover:border-accent/50 hover:bg-accent/[0.06]`}>{inner}</Link>
                  : <div className={cls}>{inner}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function Bar({ value, max, tone = "bg-accent" }: { value: number; max: number; tone?: string }) {
  return (
    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/[0.06]">
      <div className={`bar-grow h-2 rounded-full ${tone}`} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
    </div>
  );
}

/** Образ жизни: сон, тренировки и кости, радиация. */
function LifestyleRow({ a }: { a: Astronaut }) {
  const dosePct = a.dose.pct_limit;
  return (
    <div className="stagger grid gap-5 lg:grid-cols-3">
      <Panel labelledBy={`sleep-${a.id}`}>
        <PanelTitle id={`sleep-${a.id}`} icon={Moon}>Сон, последние ночи</PanelTitle>
        <ul className="flex h-32 items-end gap-2" aria-label="Длительность сна по ночам, часов">
          {a.sleep.map((s, i) => (
            <li key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
              <span className="num text-xs text-muted">{s}</span>
              <div className={`bar-rise w-full rounded-t-md ${s < 6 ? "bg-warn" : "bg-gradient-to-t from-accent-strong/70 to-accent/80"}`}
                style={{ height: `${(s / 9) * 88}px`, animationDelay: `${i * 70}ms` }} aria-hidden />
              <span className="sr-only">{s} ч{s < 6 ? ", меньше нормы" : ""}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-subtle">План NASA — 8.5 ч; на МКС в среднем ~6 ч. Жёлтым — меньше 6 ч.</p>
      </Panel>
      <Panel labelledBy={`bone-${a.id}`}>
        <PanelTitle id={`bone-${a.id}`} icon={Bone}>Тренировки и кости</PanelTitle>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm"><span className="text-muted">Сегодня</span><span className="num">{a.exercise.today} / {a.exercise.plan_per_day} мин</span></div>
            <Bar value={a.exercise.today} max={a.exercise.plan_per_day} />
          </div>
          <div>
            <div className="flex justify-between text-sm"><span className="text-muted">За 7 дней</span><span className="num">{a.exercise.last_7d} / {a.exercise.plan_per_day * 7} мин</span></div>
            <Bar value={a.exercise.last_7d} max={a.exercise.plan_per_day * 7} />
          </div>
          <div className="flex justify-between border-t border-white/5 pt-3 text-sm"><span className="text-muted">Оценка потери плотности костей</span><span className="num font-semibold">~{a.bone_loss_est_pct} %</span></div>
        </div>
        <p className="mt-2 text-sm text-subtle">Грубая оценка: ~1 % в месяц (NASA: 1–1.5 %), не измерение.</p>
      </Panel>
      <Panel labelledBy={`rad-${a.id}`}>
        <PanelTitle id={`rad-${a.id}`} icon={Radiation}>Радиация</PanelTitle>
        <p className="num text-3xl font-semibold">{a.dose.msv}<span className="ml-1 text-base font-normal text-subtle">мЗв</span></p>
        <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={dosePct} aria-label="Доля карьерного лимита 600 мЗв">
          <Bar value={dosePct} max={100} tone={dosePct >= 80 ? "bg-crit" : dosePct >= 50 ? "bg-warn" : "bg-ok"} />
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-sm">
          <span className="text-muted"><span className="num text-fg">{dosePct} %</span> лимита 600 мЗв</span>
          <StatusPill status={dosePct >= 80 ? "red" : dosePct >= 50 ? "yellow" : "green"} size="sm" />
        </div>
        <p className="mt-2 text-sm text-subtle">Сейчас: <span className="num">{a.dose.rate_msv_day}</span> мЗв/сут</p>
      </Panel>
    </div>
  );
}

/**
 * «Моё здоровье» — единый экран астронавта: состояние, что делать, показатели, динамика, образ жизни.
 * Раньше часть этого жила в отдельной карточке «Экипаж → астронавт»; теперь экран один.
 * Тревоги — во вкладке «Тревоги» и в списке дел (протоколы), здесь отдельным блоком не дублируются.
 */
export function MePage() {
  const { id = "a3" } = useParams();
  const { onboard } = useSnapshot();
  const windowMin = onboard && onboard.speed >= 60 ? 360 : 30;
  const history = useHistory(id, windowMin);
  if (!onboard) return <PageSkeleton />;
  const a = onboard.crew.find((c) => c.id === id);
  if (!a) return <EmptyState title={`Нет астронавта ${id}`} />;

  const sparkFrom = onboard.t - SPARK_MIN * 60;
  const recent = history.filter((h) => h.t >= sparkFrom);
  const messages = onboard.messages.filter((m) => m.to === "crew" || m.to === a.id);

  return (
    <div className="page space-y-5">
      <CrewSwitch current={a.id} />
      <Hero a={a} />

      <div className="grid gap-5 xl:grid-cols-12">
        <TodoPanel a={a} />
        <BodyMap key={a.id} a={a} className="xl:order-first xl:col-span-8" />
      </div>

      <Panel labelledBy={`vitals-${a.id}`}>
        <PanelTitle id={`vitals-${a.id}`} icon={HeartPulse} aside={<span className="text-xs text-subtle">тренд за {SPARK_MIN} мин</span>}>
          Показатели сейчас
        </PanelTitle>
        <div className="stagger grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-3 2xl:grid-cols-5">
          {VITALS.map((k) => <VitalTile key={k} a={a} k={k} history={recent} />)}
        </div>
      </Panel>

      <Suspense fallback={<Skeleton className="h-80" />}>
        <TrendsPanel a={a} history={history} nowT={onboard.t} windowMin={windowMin} />
      </Suspense>

      <LifestyleRow a={a} />

      {messages.length > 0 && (
        <Panel labelledBy="earth-msgs">
          <PanelTitle id="earth-msgs" icon={MessageSquare}>Сообщения с Земли</PanelTitle>
          <ul className="space-y-2">
            {messages.slice().reverse().map((m) => (
              <li key={m.id} className="tile rounded-xl border border-white/[0.06] p-4">
                <p className="text-[15px]">{m.text}</p>
                <p className="mt-1 text-xs text-subtle">
                  отправлено {fmtDur(onboard.t - m.sent_at)} назад · шло <span className="num">{fmtDur((m.delivered_at ?? m.sent_at) - m.sent_at)}</span>
                </p>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
