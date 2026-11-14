import {
  Activity, Bone, Brain, HeartPulse, ListChecks, type LucideIcon, Radiation, Ruler, ShieldPlus, Siren, Sparkles, Wind,
} from "lucide-react";
import { type KeyboardEvent, type ReactNode, useId, useState } from "react";
import { BODY_INFO, HAZARDS } from "../lib/bodyInfo";
import { statusTone } from "../lib/format";
import type { Astronaut, Status } from "../lib/types";
import { Panel, PanelTitle, StatusIcon, StatusPill } from "./ui";

export const SYSTEM_ICONS: Record<string, LucideIcon> = {
  cardio: HeartPulse, respiratory: Wind, bone_muscle: Bone, behavioral: Brain, immune: ShieldPlus, radiation: Radiation,
};

const ORDER: Record<Status, number> = { green: 0, yellow: 1, red: 2 };
const COLOR: Record<Status, string> = { green: "var(--color-ok)", yellow: "var(--color-warn)", red: "var(--color-crit)" };

// Левая половина силуэта (точки кривых Безье); правая строится зеркально.
type Seg = ["L", number, number] | ["C", number, number, number, number, number, number];
const START: [number, number] = [91, 66];
const HALF: Seg[] = [
  ["L", 90, 82], ["C", 80, 86, 62, 86, 54, 94], ["C", 46, 100, 44, 112, 44, 124], ["C", 42, 150, 38, 170, 37, 190],
  ["C", 35, 215, 31, 240, 30, 262], ["C", 28, 274, 30, 290, 36, 292], ["C", 42, 293, 44, 280, 42, 268],
  ["C", 44, 245, 48, 220, 51, 196], ["C", 54, 172, 58, 150, 62, 128], ["C", 64, 150, 70, 175, 70, 200],
  ["C", 70, 215, 64, 228, 66, 245], ["C", 66, 280, 70, 305, 72, 320], ["C", 70, 345, 74, 375, 77, 392],
  ["C", 76, 400, 68, 404, 70, 408], ["L", 94, 408], ["C", 96, 400, 95, 395, 94, 390],
  ["C", 95, 365, 92, 345, 93, 320], ["C", 95, 290, 98, 265, 100, 250],
];

function silhouette(): string {
  const m = (x: number) => 200 - x;
  let d = `M${START[0]} ${START[1]}`;
  const pts: [number, number][] = [START];
  for (const s of HALF) {
    d += s[0] === "L" ? ` L${s[1]} ${s[2]}` : ` C${s.slice(1).join(" ")}`;
    pts.push(s[0] === "L" ? [s[1], s[2]] : [s[5], s[6]]);
  }
  // обратный проход по зеркальной стороне: контрольные точки меняются местами
  for (let i = HALF.length - 1; i >= 0; i--) {
    const s = HALF[i];
    const [px, py] = pts[i];
    d += s[0] === "L" ? ` L${m(px)} ${py}` : ` C${m(s[3])} ${s[4]} ${m(s[1])} ${s[2]} ${m(px)} ${py}`;
  }
  return d + " Z";
}
const BODY = silhouette();

// знак радиации: три лепестка по 60°, центры на -90°, 30°, 150°
const TREFOIL = [-90, 30, 150].map((c) => {
  const p = (r: number, deg: number) => `${(178 + r * Math.cos((deg * Math.PI) / 180)).toFixed(2)} ${(52 + r * Math.sin((deg * Math.PI) / 180)).toFixed(2)}`;
  return `M${p(3.6, c - 30)}L${p(9.5, c - 30)}A9.5 9.5 0 0 1 ${p(9.5, c + 30)}L${p(3.6, c + 30)}A3.6 3.6 0 0 0 ${p(3.6, c - 30)}Z`;
}).join("");

const LYMPH:[number, number][] = [[92, 76], [108, 76], [67, 126], [133, 126], [86, 238], [114, 238]];

function Organ({ k, status, selected, label, onSelect, className = "", children }: {
  k: string; status: Status; selected: boolean; label: string; onSelect: (k: string) => void; className?: string; children: ReactNode;
}) {
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(k); }
  };
  return (
    <g role="button" tabIndex={0} aria-pressed={selected} aria-label={`${label}: ${statusTone[status].label.toLowerCase()}`}
      onClick={() => onSelect(k)} onKeyDown={onKey}
      className={`organ organ-${status} ${selected ? "organ-selected" : ""} ${className}`}
      style={{ ["--organ" as string]: COLOR[status] }}>
      <title>{label}</title>
      {children}
    </g>
  );
}

function Figure({ a, selected, onSelect }: { a: Astronaut; selected: string; onSelect: (k: string) => void }) {
  const uid = useId().replace(/:/g, "");
  const st = (k: string): Status => a.systems[k]?.status ?? "green";
  const props = (k: string) => ({ k, status: st(k), selected: selected === k, label: BODY_INFO[k]?.organ ?? k, onSelect });
  const beat = a.vitals.hr ? `${(60 / a.vitals.hr).toFixed(2)}s` : "1s";
  const radSel = selected === "radiation";

  return (
    <svg viewBox="-10 0 220 420" className="body-map mx-auto h-[360px] w-auto sm:h-[480px]" role="group" aria-label="Фигура человека: нажмите на орган">
      <defs>
        <clipPath id={`clip-${uid}`}>
          <path d={BODY} />
          <ellipse cx="100" cy="40" rx="25" ry="30" />
        </clipPath>
        <linearGradient id={`skin-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#60a5fa" stopOpacity="0.16" />
          <stop offset="1" stopColor="#60a5fa" stopOpacity="0.04" />
        </linearGradient>
        <linearGradient id={`scan-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#60a5fa" stopOpacity="0" />
          <stop offset="0.85" stopColor="#60a5fa" stopOpacity="0.22" />
          <stop offset="1" stopColor="#93c5fd" stopOpacity="0.7" />
        </linearGradient>
        <pattern id={`grid-${uid}`} width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M8 0H0V8" fill="none" stroke="#60a5fa" strokeOpacity="0.08" strokeWidth="0.6" />
        </pattern>
      </defs>

      {/* радиация — «поле» вокруг всего тела */}
      <g aria-hidden onClick={() => onSelect("radiation")} className={`organ organ-${st("radiation")} ${radSel ? "organ-selected" : ""}`}
        style={{ ["--organ" as string]: COLOR[st("radiation")] }}>
        <ellipse cx="100" cy="212" rx="104" ry="204" className="rad-field" fill="none" pointerEvents="stroke" />
      </g>

      {/* силуэт */}
      <g pointerEvents="none" className={radSel ? "body-irradiated" : ""} style={{ ["--organ" as string]: COLOR[st("radiation")] }}>
        <path d={BODY} fill={`url(#skin-${uid})`} className="body-outline" />
        <ellipse cx="100" cy="40" rx="25" ry="30" fill={`url(#skin-${uid})`} className="body-outline" />
      </g>
      <g clipPath={`url(#clip-${uid})`} pointerEvents="none">
        <rect x="0" y="0" width="200" height="420" fill={`url(#grid-${uid})`} />
        <rect x="0" y="-80" width="200" height="80" fill={`url(#scan-${uid})`} className="body-scan" />
      </g>

      {/* кости: позвоночник, таз, бёдра, голени, ключицы */}
      <Organ {...props("bone_muscle")}>
        <path d="M100 84V228 M76 98Q88 92 98 96 M124 98Q112 92 102 96 M84 232Q100 224 116 232Q112 246 100 248Q88 246 84 232Z
          M86 250L84 318 M114 250L116 318 M84 326L86 388 M116 326L114 388" className="bone-hit" />
        <path d="M100 84V228 M76 98Q88 92 98 96 M124 98Q112 92 102 96 M84 232Q100 224 116 232Q112 246 100 248Q88 246 84 232Z
          M86 250L84 318 M114 250L116 318 M84 326L86 388 M116 326L114 388" className="bone-line" />
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => <rect key={i} x="98" y={93 + i * 13} width="4" height="5" rx="1.5" className="vertebra" />)}
        <circle cx="84" cy="322" r="3.5" className="joint" /><circle cx="116" cy="322" r="3.5" className="joint" />
      </Organ>

      {/* лёгкие */}
      <Organ {...props("respiratory")} className="organ-breathe">
        <path d="M95 104C84 100 74 110 72 126C70 144 72 160 76 170C84 172 92 168 95 162Z" className="organ-shape" />
        <path d="M105 104C116 100 126 110 128 126C130 144 128 160 124 170C116 172 108 168 105 162Z" className="organ-shape" />
        <path d="M100 86V100M100 100Q94 104 90 112M100 100Q106 104 110 112" className="organ-detail" />
      </Organ>

      {/* сердце */}
      <Organ {...props("cardio")}>
        <g className="heart-beat" style={{ animationDuration: beat }}>
          <path d="M108 156C94 147 93 133 101 131C105 130 107 133 108 135C109 133 111 130 115 131C123 133 122 147 108 156Z" className="organ-shape" />
        </g>
      </Organ>

      {/* иммунитет: лимфоузлы и селезёнка */}
      <Organ {...props("immune")}>
        <path d="M92 76L67 126L86 238M108 76L133 126L114 238" className="organ-detail" />
        <ellipse cx="122" cy="184" rx="7" ry="4.5" transform="rotate(-25 122 184)" className="organ-shape" />
        {LYMPH.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.6" className="organ-shape" />)}
        {LYMPH.map(([x, y], i) => <circle key={`h${i}`} cx={x} cy={y} r="9" fill="transparent" />)}
        <circle cx="122" cy="184" r="10" fill="transparent" />
      </Organ>

      {/* мозг */}
      <Organ {...props("behavioral")}>
        <path d="M100 18C88 16 79 24 80 36C80 46 88 52 100 52C112 52 120 46 120 36C121 24 112 16 100 18Z" className="organ-shape" />
        <path d="M100 19V51M86 28Q92 32 88 38M114 28Q108 32 112 38M84 44Q92 42 94 46M116 44Q108 42 106 46" className="organ-detail" />
      </Organ>

      {/* значок радиации на поле */}
      <Organ {...props("radiation")}>
        <circle cx="178" cy="52" r="13" className="organ-shape rad-badge" />
        <path d={TREFOIL} className="rad-icon" />
        <circle cx="178" cy="52" r="2.2" className="rad-icon" />
      </Organ>
    </svg>
  );
}

function Section({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <div>
      <h4 className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-subtle">
        <Icon aria-hidden className="h-3.5 w-3.5" />{title}
      </h4>
      <div className="text-[15px] leading-relaxed text-muted">{children}</div>
    </div>
  );
}

/** Интерактивная фигура: органы окрашены по статусу системы, по клику — объяснение и что делать. */
export function BodyMap({ a, className = "" }: { a: Astronaut; className?: string }) {
  const keys = Object.keys(a.systems);
  const worst = keys.reduce((w, k) => (ORDER[a.systems[k].status] > ORDER[a.systems[w].status] ? k : w), keys[0] ?? "cardio");
  const [selected, setSelected] = useState(worst);
  const s = a.systems[selected];
  const info = BODY_INFO[selected];
  const Icon = SYSTEM_ICONS[selected] ?? HeartPulse;
  const titleId = `body-${a.id}`;

  return (
    <Panel className={className} labelledBy={titleId}>
      <PanelTitle id={titleId} icon={Activity} aside={<span className="text-xs text-subtle">нажмите на орган</span>}>
        Карта тела
      </PanelTitle>

      <div className="grid gap-5 md:grid-cols-[minmax(220px,260px)_1fr]">
        <div className="md:sticky md:top-6 md:self-start">
          <Figure a={a} selected={selected} onSelect={setSelected} />
        </div>

        <div className="min-w-0 space-y-4">
          <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3" aria-label="Системы организма">
            {keys.map((k) => {
              const ks = a.systems[k];
              const KIcon = SYSTEM_ICONS[k] ?? HeartPulse;
              const on = k === selected;
              return (
                <li key={k}>
                  <button type="button" aria-pressed={on} onClick={() => setSelected(k)}
                    className={`flex min-h-11 w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-sm transition-colors duration-200 ${on
                      ? "border-accent/60 bg-accent/[0.1] text-fg"
                      : `${ks.status === "green" ? "border-white/[0.06]" : statusTone[ks.status].border} bg-white/[0.02] text-muted hover:bg-white/[0.05] hover:text-fg`}`}>
                    <KIcon aria-hidden className={`h-4 w-4 shrink-0 ${statusTone[ks.status].text}`} />
                    <span className="min-w-0 flex-1 truncate" title={ks.title}>{BODY_INFO[k]?.short ?? ks.title}</span>
                    {ks.status !== "green" && <StatusIcon status={ks.status} className="h-4 w-4 shrink-0" />}
                    <span className="sr-only">{statusTone[ks.status].label}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          {s && info && (
            <div key={selected} className="body-detail space-y-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4" aria-live="polite">
              <div className="flex flex-wrap items-start gap-3">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${statusTone[s.status].bg}`}>
                  <Icon aria-hidden className={`h-6 w-6 ${statusTone[s.status].text}`} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold">{info.organ}</h3>
                    <StatusPill status={s.status} size="sm" />
                  </div>
                  <p className="mt-0.5 text-sm text-muted">Сейчас: <span className="text-fg">{s.detail}</span></p>
                </div>
              </div>

              <p className="text-[15px] leading-relaxed">{info.fn}</p>

              <Section icon={Sparkles} title="Что делает космос">
                <p>{info.space}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {info.hazards.map((h) => (
                    <span key={h} className="rounded-full border border-accent/30 bg-accent/[0.08] px-2 py-0.5 text-xs text-accent">{HAZARDS[h]}</span>
                  ))}
                </div>
              </Section>

              <div className="grid gap-4 sm:grid-cols-2">
                <Section icon={Ruler} title="Как измерить"><p>{info.measure}</p></Section>
                <Section icon={Activity} title="Норма"><p>{info.norm}</p></Section>
              </div>

              <Section icon={ListChecks} title="Что делать">
                <ul className="space-y-1">
                  {info.actions.map((t) => (
                    <li key={t} className="flex gap-2"><span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />{t}</li>
                  ))}
                </ul>
              </Section>

              <div className="flex gap-3 rounded-xl border border-crit/40 bg-crit/[0.07] p-3">
                <Siren aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-crit" />
                <p className="text-sm leading-relaxed"><span className="font-semibold text-crit">Срочно к врачу экипажа: </span>{info.doctor}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}
