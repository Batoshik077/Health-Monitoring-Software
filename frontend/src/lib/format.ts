import type { Severity, Status } from "./types";

export function fmtDur(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} с`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} мин${s % 60 && m < 10 ? ` ${s % 60} с` : ""}`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} ч${m % 60 ? ` ${m % 60} мин` : ""}`;
  return `${Math.floor(h / 24)} дн`;
}

export function fmtClock(iso: string): string {
  return iso.slice(11, 16);
}

export function fmtSimTime(t: number, nowT: number, nowIso: string): string {
  const d = new Date(new Date(nowIso).getTime() - (nowT - t) * 1000);
  return d.toISOString().slice(11, 19);
}

export const statusColor: Record<Status, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-400",
  red: "bg-rose-500",
};

export const statusText: Record<Status, string> = {
  green: "text-emerald-400",
  yellow: "text-amber-300",
  red: "text-rose-400",
};

export const statusBorder: Record<Status, string> = {
  green: "border-emerald-500/40",
  yellow: "border-amber-400/60",
  red: "border-rose-500",
};

export const severityStatus: Record<Severity, Status> = {
  info: "green",
  warning: "yellow",
  critical: "red",
};

export const severityLabel: Record<Severity, string> = {
  info: "ИНФО",
  warning: "ВНИМАНИЕ",
  critical: "КРИТИЧНО",
};

export const roleLabel: Record<string, string> = {
  commander: "командир",
  cmo: "бортовой медик",
  engineer: "инженер",
  scientist: "учёный",
  crew: "весь экипаж",
  none: "—",
  protocol: "по протоколу",
};

export const vitalMeta: Record<string, { label: string; unit: string }> = {
  hr: { label: "Пульс", unit: "уд/мин" },
  spo2: { label: "SpO₂", unit: "%" },
  rr: { label: "Дыхание", unit: "/мин" },
  sbp: { label: "Давление", unit: "мм рт. ст." },
  temp: { label: "Температура", unit: "°C" },
};
