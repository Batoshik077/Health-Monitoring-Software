import {
  Bone, Brain, ChevronRight, ClipboardCheck, Dumbbell, HeartPulse, ListChecks, MessageSquare, Moon, OctagonAlert,
  Radiation, ShieldPlus, Wind, type LucideIcon,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { AlertRow } from "../components/AlertRow";
import { EmptyState, Gauge, PageSkeleton, Panel, PanelTitle, StatusIcon, StatusPill } from "../components/ui";
import { VitalTile } from "../components/VitalTile";
import { fmtDur, readinessStatus, roleLabel, statusTone } from "../lib/format";
import { useSnapshot } from "../lib/snapshot";
import type { Todo } from "../lib/types";
import { useHistory } from "../lib/useHistory";

const SYSTEM_ICONS: Record<string, LucideIcon> = {
  cardio: HeartPulse, respiratory: Wind, bone_muscle: Bone, behavioral: Brain, immune: ShieldPlus, radiation: Radiation,
};
const TODO_ICONS: Record<Todo["kind"], LucideIcon> = { protocol: ListChecks, checkin: ClipboardCheck, exercise: Dumbbell, sleep: Moon };

/** «Моё здоровье» — главный экран астронавта: оценить состояние и понять, что делать. */
export function MeView({ id, compact = false }: { id: string; compact?: boolean }) {
  const { onboard } = useSnapshot();
  const history = useHistory(id, 10);
  if (!onboard) return <PageSkeleton />;
  const a = onboard.crew.find((c) => c.id === id);
  if (!a) return <EmptyState title={`Нет астронавта ${id}`} />;

  const myAlerts = onboard.alerts.filter((al) => al.status !== "resolved" && (
    (al.subject_type === "astronaut" && al.subject_id === a.id) ||
    (al.subject_type === "module" && al.subject_id === a.module)));
  const critical = myAlerts.find((al) => al.severity === "critical");
  const moduleName = onboard.modules.find((m) => m.id === a.module)?.name ?? a.module;
  const messages = onboard.messages.filter((m) => m.to === "crew" || m.to === a.id);
  const rs = readinessStatus(a.readiness);
  const H = compact ? "h2" : "h1";

  return (
    <div className="space-y-5">
      <Panel as="div" className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <H className="text-3xl font-semibold tracking-tight sm:text-4xl">{a.name}</H>
            <StatusPill status={a.status} label={`Состояние: ${statusTone[a.status].label.toLowerCase()}`} />
          </div>
          <p className="mt-2 text-[15px] text-muted">
            {roleLabel[a.role] ?? a.role} · {moduleName} · день миссии <span className="num text-fg">{a.mission_day}</span>
            {!a.at_rest && <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-sm text-accent">идёт тренировка</span>}
          </p>
          {!compact && (
            <Link to={`/me/${a.id}/checkin`}
              className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-control/60 bg-surface-2 px-4 text-sm font-medium hover:border-control">
              <ClipboardCheck aria-hidden className="h-4 w-4" />
              {a.checked_in_today ? "Самопроверка пройдена · пройти снова" : "Пройти самопроверку — 30 секунд"}
            </Link>
          )}
        </div>
        <div className="flex items-center gap-4">
          <Gauge value={a.readiness} status={rs} label="Индекс готовности" />
          <div>
            <p className="text-sm text-muted">Индекс готовности</p>
            <StatusPill status={rs} label={rs === "green" ? "готов к работе" : rs === "yellow" ? "снижен" : "низкий"} size="sm" />
          </div>
        </div>
      </Panel>

      {critical && (
        <Link to={`/alerts/${critical.id}`}
          className="pulse-critical enter flex flex-col gap-4 rounded-2xl border border-crit bg-crit/10 p-5 sm:flex-row sm:items-center">
          <OctagonAlert aria-hidden className="hidden h-8 w-8 shrink-0 text-crit sm:block" />
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold text-crit">{critical.message}</p>
            <p className="text-[15px] text-fg">Есть пошаговый протокол действий. Откройте его сейчас.</p>
          </div>
          <span className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-crit-strong px-4 font-semibold text-white">
            Открыть протокол <ChevronRight aria-hidden className="h-5 w-5" />
          </span>
        </Link>
      )}

      <div className={`grid gap-5 ${compact ? "" : "xl:grid-cols-12"}`}>
        <Panel className={compact ? "" : "xl:col-span-4"} labelledBy={`todo-${a.id}`}>
          <PanelTitle id={`todo-${a.id}`} icon={ListChecks}>Что сделать сейчас</PanelTitle>
          {a.todo.length === 0 ? <EmptyState title="Всё сделано">Новых дел нет. Система подскажет, если что-то изменится.</EmptyState> : (
            <ul className="space-y-2">
              {a.todo.map((t, i) => {
                const Icon = TODO_ICONS[t.kind];
                const href = t.kind === "protocol" ? `/alerts/${t.alert_id}` : t.kind === "checkin" ? `/me/${a.id}/checkin` : null;
                const urgent = t.kind === "protocol";
                const inner = (
                  <>
                    <Icon aria-hidden className={`h-5 w-5 shrink-0 ${urgent ? "text-crit" : "text-accent"}`} />
                    <span className="flex-1">{t.text}</span>
                    {href && <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-subtle" />}
                  </>
                );
                const cls = `flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2.5 text-[15px] ${urgent ? "border-crit/70 bg-crit/10" : "border-line bg-bg/60"}`;
                return <li key={i}>{href ? <Link to={href} className={`${cls} hover:border-control`}>{inner}</Link> : <div className={cls}>{inner}</div>}</li>;
              })}
            </ul>
          )}
        </Panel>

        <Panel className={compact ? "" : "xl:col-span-8"} labelledBy={`systems-${a.id}`}>
          <PanelTitle id={`systems-${a.id}`} icon={HeartPulse}>Системы организма</PanelTitle>
          <ul className="grid gap-3 sm:grid-cols-2">
            {Object.entries(a.systems).map(([k, s]) => {
              const Icon = SYSTEM_ICONS[k] ?? HeartPulse;
              return (
                <li key={k} className={`flex gap-3 rounded-xl border bg-bg/60 p-4 ${s.status === "green" ? "border-line" : statusTone[s.status].border}`}>
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${statusTone[s.status].bg}`}>
                    <Icon aria-hidden className={`h-5 w-5 ${statusTone[s.status].text}`} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{s.title}</span>
                      <StatusIcon status={s.status} className="h-4 w-4" />
                      <span className="sr-only">{statusTone[s.status].label}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-muted">{s.detail}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      <Panel labelledBy={`vitals-${a.id}`}>
        <PanelTitle id={`vitals-${a.id}`} icon={HeartPulse} aside={<span className="text-xs text-subtle">тренд за 10 мин</span>}>
          Показатели сейчас
        </PanelTitle>
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-3 2xl:grid-cols-5">
          {(["hr", "spo2", "rr", "sbp", "temp"] as const).map((k) => <VitalTile key={k} a={a} k={k} history={history} />)}
        </div>
      </Panel>

      {!compact && (
        <div className="grid gap-5 xl:grid-cols-2">
          <Panel labelledBy="my-alerts">
            <PanelTitle id="my-alerts" icon={OctagonAlert}>Мои тревоги</PanelTitle>
            {myAlerts.length === 0 ? <EmptyState title="Активных тревог нет">Если показатель выйдет за норму, здесь появится тревога и протокол действий.</EmptyState> : (
              <div className="space-y-2">{myAlerts.map((al) => <AlertRow key={al.id} alert={al} nowT={onboard.t} />)}</div>
            )}
          </Panel>
          <Panel labelledBy="earth-msgs">
            <PanelTitle id="earth-msgs" icon={MessageSquare}>Сообщения с Земли</PanelTitle>
            {messages.length === 0 ? <EmptyState icon={MessageSquare} title="Сообщений нет">Рекомендации врача с Земли приходят с задержкой связи.</EmptyState> : (
              <ul className="space-y-2">
                {messages.slice().reverse().map((m) => (
                  <li key={m.id} className="rounded-xl border border-line bg-bg/60 p-4">
                    <p className="text-[15px]">{m.text}</p>
                    <p className="mt-1 text-xs text-subtle">
                      отправлено {fmtDur(onboard.t - m.sent_at)} назад · шло <span className="num">{fmtDur((m.delivered_at ?? m.sent_at) - m.sent_at)}</span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}

export function MePage() {
  const { id = "a3" } = useParams();
  const { onboard } = useSnapshot();
  return (
    <div className="space-y-5">
      {onboard && (
        <nav aria-label="Выбор астронавта" className="flex flex-wrap gap-2">
          {onboard.crew.map((c) => (
            <Link key={c.id} to={`/me/${c.id}`} aria-current={c.id === id ? "page" : undefined}
              className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors ${c.id === id
                ? "border-transparent bg-accent-strong text-white" : "border-control/60 bg-surface-2 text-muted hover:text-fg"}`}>
              <StatusIcon status={c.status} className="h-4 w-4" />
              {c.name}
            </Link>
          ))}
        </nav>
      )}
      <MeView id={id} />
    </div>
  );
}
