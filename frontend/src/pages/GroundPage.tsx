import { Clock, Globe, MessageSquare, Send, Satellite } from "lucide-react";
import { useId, useState } from "react";
import { AlertRow } from "../components/AlertRow";
import { PageHeader } from "../components/PageHeader";
import { Button, EmptyState, PageSkeleton, Panel, PanelTitle, StatusPill } from "../components/ui";
import { api } from "../lib/api";
import { fmtDur, roleLabel } from "../lib/format";
import { useSnapshot } from "../lib/snapshot";

/** Mission Control: Земля видит только то, что долетело через канал связи. */
export function GroundPage() {
  const { ground } = useSnapshot();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const inputId = useId();
  if (!ground) return <PageSkeleton />;
  const open = ground.alerts.filter((a) => a.status !== "resolved");
  const q = ground.link.queue;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      await api.post("/api/ground/messages", { text, to: "crew" });
      setText("");
    } finally {
      setSending(false);
    }
  };

  // задержка связи показана в боковом меню — здесь её не дублируем, только очередь пакетов
  return (
    <div className="page space-y-5">
      <PageHeader eyebrow="Земля" title="Центр управления полётом">
        Земля видит только то, что дошло по каналу связи. В пути: <span className="num text-fg">{ground.link.in_flight}</span> пакетов,
        в очереди P0/P1/P2: <span className="num text-fg">{q.p0}/{q.p1}/{q.p2}</span>.
      </PageHeader>

      {ground.crew.length === 0 ? (
        <Panel><EmptyState icon={Satellite} title="С борта ещё ничего не пришло">Первые данные дойдут через {fmtDur(ground.link.delay_s)}.</EmptyState></Panel>
      ) : (
        <ul className="stagger grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          {ground.crew.map((c) => {
            const stale = c.age_s > 120;
            return (
              <li key={c.id} className={`card rounded-2xl border p-5 ${c.status === "red" ? "border-crit/70" : c.status === "yellow" ? "border-warn/50" : "border-white/[0.07]"}`}>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-semibold">{c.name ?? c.id}</h3>
                    <p className="text-sm text-muted">{roleLabel[c.role ?? ""] ?? c.role}</p>
                  </div>
                  {c.status && <StatusPill status={c.status} size="sm" />}
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2">
                  {[["Пульс", c.vitals?.hr], ["SpO₂", c.vitals?.spo2], ["Готовн.", c.readiness]].map(([l, v]) => (
                    <div key={l as string}><dt className="text-xs text-subtle">{l}</dt><dd className="num text-2xl font-semibold">{v ?? "—"}</dd></div>
                  ))}
                </dl>
                <p className={`mt-3 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm ${stale ? "bg-warn/10 text-warn" : "bg-surface-2 text-muted"}`}>
                  <Clock aria-hidden className="h-4 w-4" />данные {fmtDur(c.age_s)} назад
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel labelledBy="g-alerts">
          <PanelTitle id="g-alerts" icon={Globe} aside={<span className="text-sm text-muted"><span className="num">{open.length}</span> активных</span>}>
            Тревоги, известные Земле
          </PanelTitle>
          {ground.alerts.length === 0 ? <EmptyState title="Тревоги до Земли не доходили" /> :
            <div className="space-y-2">{ground.alerts.slice(0, 8).map((a) => <AlertRow key={a.id} alert={a} nowT={ground.t} ground />)}</div>}
        </Panel>
        <Panel labelledBy="g-msg">
          <PanelTitle id="g-msg" icon={MessageSquare}>Сообщение экипажу</PanelTitle>
          <form onSubmit={send} className="space-y-2">
            <label htmlFor={inputId} className="block text-sm text-muted">Рекомендация врача</label>
            <div className="flex flex-wrap gap-2">
              <input id={inputId} value={text} onChange={(e) => setText(e.target.value)} aria-describedby={`${inputId}-hint`}
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-control/70 bg-bg px-3 text-[16px] text-fg placeholder:text-subtle" />
              <Button type="submit" variant="primary" busy={sending} disabled={!text.trim()}>
                <Send aria-hidden className="h-4 w-4" />Отправить
              </Button>
            </div>
            <p id={`${inputId}-hint`} className="text-sm text-subtle">Дойдёт до экипажа через {fmtDur(ground.link.delay_s)}.</p>
          </form>
          {ground.messages_sent.length > 0 && (
            <ul className="mt-4 space-y-2" aria-live="polite">
              {ground.messages_sent.slice().reverse().map((m) => (
                <li key={m.id} className="rounded-xl border border-line bg-bg/60 p-3">
                  <p className="text-[15px]">{m.text}</p>
                  <p className={`mt-1 text-xs ${m.delivered_at != null ? "text-ok" : "text-subtle"}`}>
                    {m.delivered_at != null ? `доставлено за ${fmtDur(m.delivered_at - m.sent_at)}` : `в пути, дойдёт через ${fmtDur(m.eta - ground.t)}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
