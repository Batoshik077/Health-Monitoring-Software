import { useState } from "react";
import { AlertRow } from "../components/AlertRow";
import { LinkBadge } from "../components/LinkBadge";
import { Big, Button, Card, Dot, Empty, Loading, SectionTitle } from "../components/ui";
import { api } from "../lib/api";
import { fmtDur, roleLabel } from "../lib/format";
import { useSnapshot } from "../lib/snapshot";

/** Mission Control: Земля видит только то, что долетело через канал связи. */
export function GroundView({ compact = false }: { compact?: boolean }) {
  const { ground } = useSnapshot();
  const [text, setText] = useState("");
  if (!ground) return <Loading />;
  const open = ground.alerts.filter((a) => a.status !== "resolved");
  const q = ground.link.queue;

  const send = async () => {
    if (!text.trim()) return;
    await api.post("/api/ground/messages", { text, to: "crew" });
    setText("");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">🌍 Mission Control</h1>
        <LinkBadge link={ground.link} />
        <span className="text-xs text-slate-500">в пути: {ground.link.in_flight} · очередь P0/P1/P2: {q.p0}/{q.p1}/{q.p2}</span>
      </div>

      {ground.crew.length === 0 ? (
        <Card><Empty>С борта ещё ничего не пришло — первые данные дойдут через {fmtDur(ground.link.delay_s)}.</Empty></Card>
      ) : (
        <div className={`grid gap-4 sm:grid-cols-2 ${compact ? "" : "xl:grid-cols-4"}`}>
          {ground.crew.map((c) => (
            <Card key={c.id} status={c.status}>
              <div className="flex items-center gap-2">
                {c.status && <Dot status={c.status} />}
                <span className="font-semibold">{c.name ?? c.id}</span>
                <span className="ml-auto text-xs text-slate-400">{roleLabel[c.role ?? ""] ?? c.role}</span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <div><div className="text-[11px] text-slate-400">Пульс</div><Big value={c.vitals?.hr ?? "—"} /></div>
                <div><div className="text-[11px] text-slate-400">SpO₂</div><Big value={c.vitals?.spo2 ?? "—"} /></div>
                <div><div className="text-[11px] text-slate-400">Готовн.</div><Big value={c.readiness ?? "—"} /></div>
              </div>
              <div className={`mt-2 rounded px-2 py-1 text-center text-xs ${c.age_s > 120 ? "bg-amber-950/60 text-amber-300" : "bg-slate-800 text-slate-400"}`}>
                данные {fmtDur(c.age_s)} назад
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className={`grid gap-4 ${compact ? "" : "lg:grid-cols-2"}`}>
        <Card>
          <SectionTitle>Тревоги, известные Земле ({open.length} активных)</SectionTitle>
          {ground.alerts.length === 0 ? <Empty>Нет</Empty> :
            <div className="space-y-2">{ground.alerts.slice(0, 8).map((a) => <AlertRow key={a.id} alert={a} nowT={ground.t} ground />)}</div>}
        </Card>
        <Card>
          <SectionTitle>Сообщение экипажу</SectionTitle>
          <div className="flex gap-2">
            <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Рекомендация врача…" className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            <Button variant="primary" onClick={send}>Отправить</Button>
          </div>
          <ul className="mt-3 space-y-2">
            {ground.messages_sent.slice().reverse().map((m) => (
              <li key={m.id} className="rounded-lg border border-slate-800 bg-slate-950/50 p-2 text-sm">
                <div>{m.text}</div>
                <div className="text-[11px] text-slate-500">
                  {m.delivered_at != null ? `доставлено за ${fmtDur(m.delivered_at - m.sent_at)}` : `дойдёт через ${fmtDur(m.eta - ground.t)}`}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

export function GroundPage() {
  return <GroundView />;
}
