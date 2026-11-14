import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertRow } from "../components/AlertRow";
import { Big, Card, Dot, Empty, Loading, SectionTitle } from "../components/ui";
import { VitalTile } from "../components/VitalTile";
import { fmtDur, roleLabel, statusText } from "../lib/format";
import { useSnapshot } from "../lib/snapshot";
import type { Status } from "../lib/types";

const readinessStatus = (r: number): Status => (r >= 70 ? "green" : r >= 50 ? "yellow" : "red");

/** «Моё здоровье» — главный экран астронавта: оценить состояние и понять, что делать. */
export function MeView({ id, compact = false }: { id: string; compact?: boolean }) {
  const { onboard } = useSnapshot();
  const navigate = useNavigate();
  if (!onboard) return <Loading />;
  const a = onboard.crew.find((c) => c.id === id);
  if (!a) return <Empty>Нет астронавта {id}</Empty>;
  const myAlerts = onboard.alerts.filter((al) => al.status !== "resolved" && (
    (al.subject_type === "astronaut" && al.subject_id === a.id) ||
    (al.subject_type === "module" && al.subject_id === a.module)));
  const critical = myAlerts.find((al) => al.severity === "critical");
  const moduleName = onboard.modules.find((m) => m.id === a.module)?.name ?? a.module;
  const messages = onboard.messages.filter((m) => m.to === "crew" || m.to === a.id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Dot status={a.status} />
            <h1 className="text-2xl font-bold">{a.name}</h1>
          </div>
          <div className="text-sm text-slate-400">
            {roleLabel[a.role] ?? a.role} · {moduleName} · день миссии {a.mission_day}
            {!a.at_rest && <span className="ml-2 text-sky-300">идёт тренировка</span>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-400">Индекс готовности</div>
          <Big value={a.readiness} status={readinessStatus(a.readiness)} suffix="/100" />
        </div>
      </div>

      {critical && (
        <Card status="red" pulse className="cursor-pointer" >
          <div onClick={() => navigate(`/alerts/${critical.id}`)}>
            <div className="text-lg font-bold text-rose-300">⚠ {critical.message}</div>
            <div className="mt-1 text-sm text-slate-300">Нажмите, чтобы открыть протокол действий</div>
          </div>
        </Card>
      )}

      <div className={`grid gap-4 ${compact ? "" : "lg:grid-cols-3"}`}>
        <Card className="lg:col-span-1">
          <SectionTitle>Что сделать сейчас</SectionTitle>
          {a.todo.length === 0 ? <Empty>Всё в порядке, дел нет</Empty> : (
            <ul className="space-y-2">
              {a.todo.map((t, i) => {
                const href = t.kind === "protocol" ? `/alerts/${t.alert_id}` : t.kind === "checkin" ? `/me/${a.id}/checkin` : null;
                const cls = `block rounded-lg border px-3 py-2 text-sm ${t.kind === "protocol" ? "border-rose-500/60 bg-rose-950/40" : "border-slate-800 bg-slate-950/50"}`;
                return <li key={i}>{href ? <Link to={href} className={`${cls} hover:brightness-125`}>{t.text} →</Link> : <div className={cls}>{t.text}</div>}</li>;
              })}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <SectionTitle>Системы организма</SectionTitle>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(a.systems).map(([k, s]) => (
              <div key={k} className="flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                <Dot status={s.status} className="mt-1 shrink-0" />
                <div>
                  <div className={`text-sm font-semibold ${statusText[s.status]}`}>{s.title}</div>
                  <div className="text-xs text-slate-400">{s.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <SectionTitle>Показатели сейчас</SectionTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {(["hr", "spo2", "rr", "sbp", "temp"] as const).map((k) => <VitalTile key={k} a={a} k={k} />)}
        </div>
        {!a.quality_ok && <p className="mt-2 text-sm text-amber-300">Проблема с датчиком: {a.bad_metrics.join(", ")}</p>}
      </Card>

      {!compact && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <SectionTitle>Мои тревоги</SectionTitle>
            {myAlerts.length === 0 ? <Empty>Активных тревог нет</Empty> : (
              <div className="space-y-2">{myAlerts.map((al) => <AlertRow key={al.id} alert={al} nowT={onboard.t} />)}</div>
            )}
          </Card>
          <Card>
            <SectionTitle>Сообщения с Земли</SectionTitle>
            {messages.length === 0 ? <Empty>Сообщений нет</Empty> : (
              <ul className="space-y-2">
                {messages.slice().reverse().map((m) => (
                  <li key={m.id} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-sm">
                    <div>{m.text}</div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      отправлено {fmtDur(onboard.t - m.sent_at)} назад, шло {fmtDur((m.delivered_at ?? m.sent_at) - m.sent_at)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

export function MePage() {
  const { id = "a3" } = useParams();
  const { onboard } = useSnapshot();
  return (
    <div className="space-y-4">
      {onboard && (
        <div className="flex flex-wrap gap-2 text-sm">
          {onboard.crew.map((c) => (
            <Link key={c.id} to={`/me/${c.id}`}
              className={`rounded-full px-3 py-1 ${c.id === id ? "bg-sky-700 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>
              {c.name}
            </Link>
          ))}
          <Link to={`/me/${id}/checkin`} className="ml-auto rounded-full bg-emerald-700 px-3 py-1 text-white hover:bg-emerald-600">
            Самопроверка
          </Link>
        </div>
      )}
      <MeView id={id} />
    </div>
  );
}
