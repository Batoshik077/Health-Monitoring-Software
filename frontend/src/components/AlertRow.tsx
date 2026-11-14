import { Link } from "react-router-dom";
import { fmtDur, roleLabel, severityLabel, severityStatus, statusText } from "../lib/format";
import type { Alert } from "../lib/types";
import { Dot } from "./ui";

export function AlertRow({ alert, nowT, ground = false }: { alert: Alert; nowT: number; ground?: boolean }) {
  const st = severityStatus[alert.severity];
  const body = (
    <div className={`flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3 ${alert.status === "resolved" ? "opacity-50" : ""}`}>
      <Dot status={st} className="mt-1.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className={`font-semibold ${statusText[st]}`}>{severityLabel[alert.severity]}</span>
          <span className="font-medium">{alert.subject_name}</span>
          <span className="text-xs text-slate-500">{fmtDur(nowT - alert.created_at)} назад</span>
        </div>
        <div className="text-sm text-slate-300">{alert.message}</div>
        <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-500">
          <span>{{ active: "активна", acknowledged: "подтверждена", resolved: "закрыта" }[alert.status]}</span>
          {!alert.condition_active && alert.status !== "resolved" && <span className="text-emerald-400">показатель в норме</span>}
          {alert.escalated_to && <span className="text-amber-300">эскалация: {roleLabel[alert.escalated_to] ?? alert.escalated_to}</span>}
          {ground && alert.first_received_at != null && (
            <span className="text-sky-300">дошла до Земли через {fmtDur(alert.first_received_at - alert.created_at)}</span>
          )}
        </div>
      </div>
    </div>
  );
  return ground ? body : <Link to={`/alerts/${alert.id}`} className="block hover:brightness-125">{body}</Link>;
}
