import { ArrowLeft, Check, CircleCheck, Clock, History, ListChecks, Timer, TriangleAlert, UserRound } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button, EmptyState, PageSkeleton, Panel, PanelTitle, StatusPill } from "../components/ui";
import { api } from "../lib/api";
import { fmtDur, roleLabel, severityLabel, severityStatus } from "../lib/format";
import { useSnapshot } from "../lib/snapshot";

const EVENT: Record<string, string> = {
  created: "тревога создана", severity_up: "уровень повышен", acknowledged: "подтверждена",
  escalated: "передана дальше", condition_cleared: "показатель вернулся в норму", resolved: "закрыта",
};

const RUN_STATUS: Record<string, { text: string; tone: "ok" | "warn" | "muted" }> = {
  in_progress: { text: "Выполняется", tone: "muted" },
  rechecking: { text: "Ждём перепроверку показателя", tone: "muted" },
  improved: { text: "Стало лучше — тревога закрыта", tone: "ok" },
  not_improved: { text: "Лучше не стало — передано дальше", tone: "warn" },
  closed: { text: "Закрыт вручную", tone: "muted" },
};

/** Тревога и протокол: что случилось простыми словами и что делать по шагам. */
export function AlertPage() {
  const { id = "" } = useParams();
  const { onboard } = useSnapshot();
  // Мгновенный отклик на нажатие: показываем галочку сразу, сервер подтверждает в фоне
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});
  if (!onboard) return <PageSkeleton />;
  const alert = onboard.alerts.find((a) => a.id === id);
  if (!alert) {
    return (
      <EmptyState title="Тревога не найдена">
        Возможно, симуляция была сброшена. <Link to="/alerts" className="text-accent underline">Открыть список тревог</Link>
      </EmptyState>
    );
  }
  const run = onboard.protocol_runs.find((r) => r.id === alert.protocol_run_id);
  const st = severityStatus[alert.severity];
  const t = onboard.t;
  const isDone = (n: number) => {
    const key = `${run?.id}:${n}`;
    return key in optimistic ? optimistic[key] : !!run?.steps_done[n];
  };
  const done = run ? run.steps.filter((_, n) => isDone(n)).length : 0;
  const locked = !run || run.status !== "in_progress";
  const status = run ? RUN_STATUS[run.status] : null;
  const recheckLeft = run?.recheck_at != null ? Math.max(0, run.recheck_at - t) : null;

  const step = (n: number, value: boolean) => {
    if (!run) return;
    const key = `${run.id}:${n}`;
    setOptimistic((o) => ({ ...o, [key]: value }));
    api.post(`/api/protocol-runs/${run.id}/steps/${n}`, { done: value })
      .catch(() => setOptimistic((o) => { const c = { ...o }; delete c[key]; return c; }));
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link to="/alerts" className="inline-flex min-h-11 items-center gap-2 rounded-xl text-sm text-muted hover:text-fg">
        <ArrowLeft aria-hidden className="h-4 w-4" /> Все тревоги
      </Link>

      <Panel status={alert.status === "resolved" ? undefined : st} pulse={alert.severity === "critical" && alert.status === "active"} as="div">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={alert.status === "resolved" ? "green" : st}
            label={alert.status === "resolved" ? "Закрыта" : severityLabel[alert.severity]} />
          <span className="inline-flex items-center gap-1.5 text-sm text-muted"><UserRound aria-hidden className="h-4 w-4" />{alert.subject_name}</span>
          <span className="inline-flex items-center gap-1.5 text-sm text-subtle"><Clock aria-hidden className="h-4 w-4" />{fmtDur(t - alert.created_at)} назад</span>
        </div>
        <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight">{run?.title ?? alert.message}</h1>
        <p className="mt-2 text-lg text-fg">{alert.message}</p>
        {run?.explain && <p className="mt-1 text-[15px] text-muted">{run.explain}</p>}
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          {!alert.condition_active && alert.status !== "resolved" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-ok/10 px-3 py-1 text-ok"><CircleCheck aria-hidden className="h-4 w-4" />показатель вернулся в норму</span>
          )}
          {run && run.call !== "none" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-muted">уведомлён: {roleLabel[run.call] ?? run.call}</span>
          )}
          {alert.escalated_to && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-warn/10 px-3 py-1 text-warn"><TriangleAlert aria-hidden className="h-4 w-4" />передано: {roleLabel[alert.escalated_to] ?? alert.escalated_to}</span>
          )}
        </div>
      </Panel>

      {run ? (
        <Panel labelledBy="steps-title">
          <PanelTitle id="steps-title" icon={ListChecks} aside={<span className="num text-sm text-muted">{done} из {run.steps.length}</span>}>
            Что делать — по шагам
          </PanelTitle>
          <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={run.steps.length}
            aria-valuenow={done} aria-label="Выполнено шагов">
            <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${(done / run.steps.length) * 100}%` }} />
          </div>
          <ol className="space-y-2">
            {run.steps.map((s, n) => {
              const checked = isDone(n);
              return (
                <li key={n}>
                  <label className={`flex min-h-14 cursor-pointer items-center gap-4 rounded-xl border p-4 transition-colors ${checked
                    ? "border-ok/50 bg-ok/5" : "border-control/60 bg-bg/60 hover:border-control"} ${locked ? "cursor-default" : ""}`}>
                    <input type="checkbox" className="peer sr-only" checked={checked} disabled={locked}
                      onChange={(e) => step(n, e.target.checked)} />
                    <span aria-hidden className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 font-mono text-sm font-semibold peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent ${checked
                      ? "border-ok bg-ok text-bg" : "border-control text-muted"}`}>
                      {checked ? <Check className="h-4 w-4" strokeWidth={3} /> : n + 1}
                    </span>
                    <span className={`text-[16px] leading-snug ${checked ? "text-muted line-through decoration-1" : "text-fg"}`}>{s}</span>
                  </label>
                </li>
              );
            })}
          </ol>
          <div aria-live="polite" className={`mt-5 flex flex-wrap items-center gap-3 rounded-xl border p-4 ${status?.tone === "ok" ? "border-ok/50 bg-ok/5" : status?.tone === "warn" ? "border-warn/50 bg-warn/5" : "border-line bg-bg/60"}`}>
            <Timer aria-hidden className={`h-5 w-5 ${status?.tone === "ok" ? "text-ok" : status?.tone === "warn" ? "text-warn" : "text-accent"}`} />
            <div>
              <p className="font-medium">{status?.text}</p>
              {run.status === "rechecking" && recheckLeft != null && (
                <p className="text-sm text-muted">Перепроверка показателя через <span className="num text-fg">{fmtDur(recheckLeft)}</span></p>
              )}
              {run.status === "in_progress" && (
                <p className="text-sm text-muted">Отметьте все шаги — через {fmtDur(run.recheck_after_s)} система сама проверит, стало ли лучше.</p>
              )}
            </div>
          </div>
        </Panel>
      ) : (
        <Panel><EmptyState title="Для этой тревоги протокол не задан">Обратитесь к бортовому медику.</EmptyState></Panel>
      )}

      {alert.status !== "resolved" && (
        <div className="flex flex-wrap gap-3">
          {alert.status === "active" && (
            <Button variant="primary" onClick={() => api.post(`/api/alerts/${alert.id}/ack`, { by: "crew" })}>Я вижу тревогу</Button>
          )}
          <Button variant="ghost" onClick={() => {
            if (window.confirm("Закрыть тревогу вручную? Перепроверка протокола не будет выполнена.")) {
              api.post(`/api/alerts/${alert.id}/resolve`, { resolution: "Закрыто вручную" });
            }
          }}>Закрыть тревогу вручную</Button>
        </div>
      )}

      <Panel labelledBy="history-title">
        <PanelTitle id="history-title" icon={History}>История</PanelTitle>
        <ol className="relative space-y-3 border-l border-line pl-5">
          {alert.history.map((h, i) => (
            <li key={i} className="relative">
              <span aria-hidden className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-control" />
              <p className="text-[15px]">
                {EVENT[String(h.event)] ?? String(h.event)}
                {h.by ? <span className="text-muted"> · {roleLabel[String(h.by)] ?? String(h.by)}</span> : null}
                {h.to ? <span className="text-muted"> → {roleLabel[String(h.to)] ?? String(h.to)}</span> : null}
              </p>
              <p className="text-xs text-subtle">{fmtDur(t - h.t)} назад</p>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}
