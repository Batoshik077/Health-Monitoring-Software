import { ChevronRight, Clock, Satellite } from "lucide-react";
import { Link } from "react-router-dom";
import { fmtDur, roleLabel, severityLabel, severityStatus } from "../lib/format";
import type { Alert } from "../lib/types";
import { StatusPill } from "./ui";

const STATUS_RU = { active: "активна", acknowledged: "подтверждена", resolved: "закрыта" } as const;

export function AlertRow({ alert, nowT, ground = false }: { alert: Alert; nowT: number; ground?: boolean }) {
  const st = severityStatus[alert.severity];
  const body = (
    <div className={`flex items-start gap-3 rounded-xl border bg-bg/60 p-4 transition-colors ${alert.status === "resolved" ? "border-line opacity-70" : st === "red" ? "border-crit/70" : "border-line"} ${ground ? "" : "group-hover:border-control"}`}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={alert.status === "resolved" ? "green" : st}
            label={alert.status === "resolved" ? `${severityLabel[alert.severity]} · закрыта` : severityLabel[alert.severity]} size="sm" />
          <span className="font-medium">{alert.subject_name}</span>
          <span className="inline-flex items-center gap-1 text-xs text-subtle">
            <Clock aria-hidden className="h-3.5 w-3.5" />{fmtDur(nowT - alert.created_at)} назад
          </span>
        </div>
        <p className="mt-1.5 text-[15px] leading-snug text-fg">{alert.message}</p>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-subtle">
          {alert.status !== "resolved" && <span>{STATUS_RU[alert.status]}</span>}
          {!alert.condition_active && alert.status !== "resolved" && <span className="text-ok">показатель вернулся в норму</span>}
          {alert.escalated_to && <span className="text-warn">передано: {roleLabel[alert.escalated_to] ?? alert.escalated_to}</span>}
          {ground && alert.first_received_at != null && (
            <span className="inline-flex items-center gap-1 text-accent">
              <Satellite aria-hidden className="h-3.5 w-3.5" />
              дошла до Земли через {fmtDur(alert.first_received_at - alert.created_at)}
            </span>
          )}
        </div>
      </div>
      {!ground && <ChevronRight aria-hidden className="mt-1 h-5 w-5 shrink-0 text-subtle group-hover:text-fg" />}
    </div>
  );
  return ground ? body : (
    <Link to={`/alerts/${alert.id}`} className="group block rounded-xl"
      aria-label={`${severityLabel[alert.severity]}: ${alert.subject_name}. ${alert.message}. Открыть протокол`}>
      {body}
    </Link>
  );
}
