import { CircleCheck, Inbox, OctagonAlert, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { statusTone } from "../lib/format";
import type { Status } from "../lib/types";

const STATUS_ICON: Record<Status, LucideIcon> = { green: CircleCheck, yellow: TriangleAlert, red: OctagonAlert };

/** Статус = иконка + текст + цвет. Никогда не только цвет. */
export function StatusPill({ status, label, size = "md" }: { status: Status; label?: string; size?: "sm" | "md" }) {
  const t = statusTone[status];
  const Icon = STATUS_ICON[status];
  const sz = size === "sm" ? "gap-1 px-2 py-0.5 text-xs" : "gap-1.5 px-2.5 py-1 text-sm";
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full border font-medium ${t.text} ${t.bg} ${t.border} ${sz}`}>
      <Icon aria-hidden className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={2.25} />
      {label ?? t.label}
    </span>
  );
}

export function StatusIcon({ status, className = "h-5 w-5" }: { status: Status; className?: string }) {
  const Icon = STATUS_ICON[status];
  return <Icon aria-hidden className={`${statusTone[status].text} ${className}`} strokeWidth={2.25} />;
}

export function Panel({ children, status, className = "", pulse = false, as: Tag = "section", labelledBy }: {
  children: ReactNode; status?: Status; className?: string; pulse?: boolean; as?: "section" | "div" | "article";
  labelledBy?: string;
}) {
  const border = status && status !== "green" ? statusTone[status].border : "border-line";
  return (
    <Tag aria-labelledby={labelledBy}
      className={`rounded-2xl border ${border} bg-surface/90 p-5 shadow-[0_1px_0_rgb(255_255_255/0.03)_inset] ${pulse ? "pulse-critical" : ""} ${className}`}>
      {children}
    </Tag>
  );
}

export function PanelTitle({ id, icon: Icon, children, aside }: { id?: string; icon?: LucideIcon; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      {Icon && <Icon aria-hidden className="h-4 w-4 text-subtle" strokeWidth={2} />}
      <h2 id={id} className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-muted">{children}</h2>
      {aside && <div className="ml-auto">{aside}</div>}
    </div>
  );
}

type Variant = "default" | "primary" | "danger" | "ghost" | "segment";

export function Button({ children, onClick, variant = "default", disabled, className = "", pressed, type = "button", label, busy }: {
  children: ReactNode; onClick?: () => void; variant?: Variant; disabled?: boolean; className?: string;
  pressed?: boolean; type?: "button" | "submit"; label?: string; busy?: boolean;
}) {
  const styles: Record<Variant, string> = {
    default: "bg-surface-2 text-fg border border-control/60 hover:border-control hover:bg-[#1f2532]",
    primary: "bg-accent-strong text-white hover:bg-[#1d4ed8] border border-transparent",
    danger: "bg-crit-strong text-white hover:bg-[#b91c1c] border border-transparent",
    ghost: "bg-transparent text-muted border border-control/60 hover:text-fg hover:border-control",
    segment: pressed
      ? "bg-accent-strong text-white border border-transparent"
      : "bg-surface-2 text-muted border border-control/60 hover:text-fg",
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled || busy} aria-pressed={pressed} aria-label={label}
      aria-busy={busy || undefined}
      className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors duration-150 active:brightness-90 disabled:cursor-not-allowed disabled:opacity-45 ${styles[variant]} ${className}`}>
      {children}
    </button>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, children }: { icon?: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line px-4 py-8 text-center">
      <Icon aria-hidden className="h-6 w-6 text-subtle" />
      <p className="text-sm font-medium text-muted">{title}</p>
      {children && <p className="max-w-sm text-sm text-subtle">{children}</p>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`skeleton rounded-xl ${className}`} />;
}

export function PageSkeleton() {
  return (
    <div role="status" aria-label="Подключение к бортовой системе" className="space-y-4">
      <Skeleton className="h-24" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-64" />
        <Skeleton className="h-64 lg:col-span-2" />
      </div>
      <Skeleton className="h-40" />
    </div>
  );
}

/** Кольцевой индикатор (gauge) для одного показателя против цели — рекомендация скилла для KPI. */
export function Gauge({ value, max = 100, status, label, size = 112 }: {
  value: number; max?: number; status: Status; label: string; size?: number;
}) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value / max));
  const color = { green: "var(--color-ok)", yellow: "var(--color-warn)", red: "var(--color-crit)" }[status];
  return (
    <div className="relative" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${value} из ${max}, ${statusTone[status].label.toLowerCase()}`}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-line)" strokeWidth="8" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`} style={{ transition: "stroke-dasharray 400ms cubic-bezier(0.16,1,0.3,1)" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden>
        <span className="num text-3xl font-semibold leading-none">{value}</span>
        <span className="mt-1 text-xs text-subtle">из {max}</span>
      </div>
    </div>
  );
}

/** Мини-график тренда без осей. Декоративный: значение и норма всегда показаны текстом рядом. */
export function Sparkline({ values, className = "", status = "green", minSpan = 0 }: {
  values: (number | null)[]; className?: string; status?: Status; minSpan?: number;
}) {
  const pts = values.filter((v): v is number => v != null);
  if (pts.length < 2) return <div className={className} aria-hidden />;
  const mid = (Math.min(...pts) + Math.max(...pts)) / 2;
  const span = Math.max(Math.max(...pts) - Math.min(...pts), minSpan) || 1;
  const min = mid - span / 2;
  const step = 100 / (values.length - 1);
  const d = values
    .map((v, i) => (v == null ? null : `${(i * step).toFixed(2)},${(28 - ((v - min) / span) * 24).toFixed(2)}`))
    .filter(Boolean)
    .join(" ");
  const color = { green: "var(--color-accent)", yellow: "var(--color-warn)", red: "var(--color-crit)" }[status];
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={className} aria-hidden>
      <polyline points={d} fill="none" stroke={color} strokeWidth="1.75" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}
