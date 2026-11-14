import { useParams } from "react-router-dom";
import { Button, Card, Empty, Loading, SectionTitle } from "../components/ui";
import { api } from "../lib/api";
import { fmtDur, roleLabel, severityLabel, severityStatus, statusText } from "../lib/format";
import { useSnapshot } from "../lib/snapshot";

const EVENT: Record<string, string> = {
  created: "тревога создана", severity_up: "уровень повышен", acknowledged: "подтверждена",
  escalated: "эскалация", condition_cleared: "показатель вернулся в норму", resolved: "закрыта",
};

const RUN_STATUS: Record<string, string> = {
  in_progress: "выполняется",
  rechecking: "ждём перепроверку",
  improved: "стало лучше — тревога закрыта",
  not_improved: "лучше не стало — передано дальше",
  closed: "закрыт вручную",
};

/** Тревога и протокол: что случилось простыми словами и что делать по шагам. */
export function AlertPage() {
  const { id = "" } = useParams();
  const { onboard } = useSnapshot();
  if (!onboard) return <Loading />;
  const alert = onboard.alerts.find((a) => a.id === id);
  if (!alert) return <Empty>Тревога не найдена (возможно, была сброшена симуляция)</Empty>;
  const run = onboard.protocol_runs.find((r) => r.id === alert.protocol_run_id);
  const st = severityStatus[alert.severity];
  const t = onboard.t;

  const step = (n: number, done: boolean) => run && api.post(`/api/protocol-runs/${run.id}/steps/${n}`, { done });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card status={st} pulse={alert.severity === "critical" && alert.status === "active"}>
        <div className={`text-sm font-bold ${statusText[st]}`}>{severityLabel[alert.severity]} · {alert.subject_name}</div>
        <h1 className="mt-1 text-2xl font-bold">{run?.title ?? alert.message}</h1>
        <p className="mt-2 text-slate-300">{alert.message}</p>
        {run?.explain && <p className="mt-1 text-sm text-slate-400">{run.explain}</p>}
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
          <span>{fmtDur(t - alert.created_at)} назад</span>
          {!alert.condition_active && alert.status !== "resolved" && <span className="text-emerald-400">показатель вернулся в норму</span>}
          {alert.escalated_to && <span className="text-amber-300">эскалация: {roleLabel[alert.escalated_to] ?? alert.escalated_to}</span>}
          {run && run.call !== "none" && <span>уведомлён: {roleLabel[run.call] ?? run.call}</span>}
        </div>
      </Card>

      {run ? (
        <Card>
          <SectionTitle>Что делать — по шагам</SectionTitle>
          <ol className="space-y-2">
            {run.steps.map((s, n) => {
              const done = run.steps_done[n];
              const locked = run.status !== "in_progress";
              return (
                <li key={n}>
                  <button disabled={locked} onClick={() => step(n, !done)}
                    className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left ${done ? "border-emerald-600/60 bg-emerald-950/30" : "border-slate-700 bg-slate-950/50 hover:border-slate-500"}`}>
                    <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-sm ${done ? "border-emerald-400 bg-emerald-500 text-slate-950" : "border-slate-500"}`}>
                      {done ? "✓" : n + 1}
                    </span>
                    <span className={done ? "text-slate-400 line-through" : ""}>{s}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="mt-4 rounded-lg bg-slate-950/60 p-3 text-sm">
            <div>Статус протокола: <b>{RUN_STATUS[run.status] ?? run.status}</b></div>
            {run.status === "rechecking" && run.recheck_at != null && (
              <div className="text-sky-300">Перепроверка показателя через {fmtDur(run.recheck_at - t)}</div>
            )}
            {run.status === "in_progress" && (
              <div className="text-slate-400">После последнего шага система через {fmtDur(run.recheck_after_s)} проверит, стало ли лучше.</div>
            )}
          </div>
        </Card>
      ) : (
        <Card><Empty>Для этой тревоги протокол не задан — обратитесь к бортовому медику.</Empty></Card>
      )}

      <div className="flex flex-wrap gap-2">
        {alert.status === "active" && <Button variant="primary" onClick={() => api.post(`/api/alerts/${alert.id}/ack`, { by: "crew" })}>Подтвердить, что видел</Button>}
        {alert.status !== "resolved" && <Button variant="ghost" onClick={() => api.post(`/api/alerts/${alert.id}/resolve`, { resolution: "Закрыто вручную" })}>Закрыть тревогу</Button>}
      </div>

      <Card>
        <SectionTitle>История</SectionTitle>
        <ul className="space-y-1 text-sm text-slate-400">
          {alert.history.map((h, i) => (
            <li key={i}>{fmtDur(t - h.t)} назад — {EVENT[String(h.event)] ?? String(h.event)}{h.by ? ` (${roleLabel[String(h.by)] ?? String(h.by)})` : ""}{h.to ? ` → ${roleLabel[String(h.to)] ?? String(h.to)}` : ""}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
