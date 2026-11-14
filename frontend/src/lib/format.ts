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

/** Токены статуса: цвет всегда дополняется иконкой и текстом (color-not-only). */
export const statusTone: Record<Status, { text: string; bg: string; border: string; label: string }> = {
  green: { text: "text-ok", bg: "bg-ok/10", border: "border-ok/40", label: "Норма" },
  yellow: { text: "text-warn", bg: "bg-warn/10", border: "border-warn/50", label: "Внимание" },
  red: { text: "text-crit", bg: "bg-crit/10", border: "border-crit/70", label: "Критично" },
};

export const severityStatus: Record<Severity, Status> = {
  info: "green",
  warning: "yellow",
  critical: "red",
};

export const severityLabel: Record<Severity, string> = {
  info: "Инфо",
  warning: "Внимание",
  critical: "Критично",
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

export const vitalMeta: Record<string, { label: string; unit: string; normal: string }> = {
  hr: { label: "Пульс", unit: "уд/мин", normal: "51–90" },
  spo2: { label: "SpO₂", unit: "%", normal: "≥ 96" },
  rr: { label: "Дыхание", unit: "/мин", normal: "12–20" },
  sbp: { label: "Давление", unit: "мм рт. ст.", normal: "111–219" },
  temp: { label: "Температура", unit: "°C", normal: "36.1–38.0" },
};

export const readinessStatus = (r: number): Status => (r >= 70 ? "green" : r >= 50 ? "yellow" : "red");
