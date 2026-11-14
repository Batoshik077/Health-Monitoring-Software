import type { ReactNode } from "react";
import { statusBorder, statusColor, statusText } from "../lib/format";
import type { Status } from "../lib/types";

export function Dot({ status, className = "" }: { status: Status; className?: string }) {
  return <span className={`inline-block h-3 w-3 rounded-full ${statusColor[status]} ${className}`} />;
}

export function Card({ children, status, className = "", pulse = false }: {
  children: ReactNode; status?: Status; className?: string; pulse?: boolean;
}) {
  const border = status ? statusBorder[status] : "border-slate-800";
  return (
    <div className={`rounded-xl border ${border} bg-slate-900/70 p-4 ${pulse ? "pulse-critical" : ""} ${className}`}>
      {children}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">{children}</h2>;
}

export function Big({ value, status, suffix }: { value: ReactNode; status?: Status; suffix?: string }) {
  return (
    <span className={`text-3xl font-bold tabular-nums ${status ? statusText[status] : ""}`}>
      {value}
      {suffix && <span className="ml-1 text-base font-normal text-slate-400">{suffix}</span>}
    </span>
  );
}

export function Button({ children, onClick, variant = "default", disabled, className = "" }: {
  children: ReactNode; onClick?: () => void; variant?: "default" | "primary" | "danger" | "ghost";
  disabled?: boolean; className?: string;
}) {
  const styles = {
    default: "bg-slate-800 hover:bg-slate-700 text-slate-100",
    primary: "bg-sky-600 hover:bg-sky-500 text-white",
    danger: "bg-rose-600 hover:bg-rose-500 text-white",
    ghost: "bg-transparent hover:bg-slate-800 text-slate-300 border border-slate-700",
  }[variant];
  return (
    <button onClick={onClick} disabled={disabled}
      className={`rounded-lg px-3 py-2 text-sm font-medium transition disabled:opacity-40 ${styles} ${className}`}>
      {children}
    </button>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-slate-500">{children}</p>;
}

export function Loading() {
  return <div className="p-8 text-slate-400">Подключение к бортовой системе…</div>;
}
