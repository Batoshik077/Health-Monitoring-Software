import { fmtDur } from "../lib/format";
import type { LinkStatus } from "../lib/types";

export function LinkBadge({ link }: { link: LinkStatus }) {
  const queued = link.queue.p0 + link.queue.p1 + link.queue.p2;
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ${link.up ? "bg-slate-800 text-slate-300" : "bg-rose-950 text-rose-300"}`}>
      <span className={`h-2 w-2 rounded-full ${link.up ? "bg-emerald-400" : "bg-rose-500"}`} />
      {link.up ? `Связь с Землёй: задержка ${fmtDur(link.delay_s)}` : "Нет связи с Землёй"}
      {queued > 0 && <span className="text-slate-500">· в очереди {queued}</span>}
    </span>
  );
}
