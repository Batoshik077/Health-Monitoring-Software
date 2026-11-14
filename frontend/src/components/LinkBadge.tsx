import { RadioTower, WifiOff } from "lucide-react";
import { fmtDur } from "../lib/format";
import type { LinkStatus } from "../lib/types";

export function LinkBadge({ link, compact = false }: { link: LinkStatus; compact?: boolean }) {
  const queued = link.queue.p0 + link.queue.p1 + link.queue.p2;
  const Icon = link.up ? RadioTower : WifiOff;
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${link.up ? "border-line bg-surface-2 text-muted" : "border-crit/70 bg-crit/10 text-crit"}`}>
      <Icon aria-hidden className="h-4 w-4 shrink-0" />
      <span>
        {link.up
          ? compact
            ? <span title="Задержка связи с Землёй">Связь · <span className="num text-fg">{fmtDur(link.delay_s)}</span></span>
            : <>Земля: задержка <span className="num text-fg">{fmtDur(link.delay_s)}</span></>
          : "Нет связи с Землёй"}
        {!compact && queued > 0 && <span className="text-subtle"> · в очереди <span className="num">{queued}</span></span>}
      </span>
    </span>
  );
}
