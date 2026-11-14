import { Camera, Info, ScanFace, Sparkles, Upload, WandSparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, Panel, PanelTitle } from "./ui";

// ДЕМО: анализ имитирован — для каждого примера заранее подготовлен результат.
// В полёте здесь будет модель распознавания лица на бортовом компьютере (фото не покидает борт).

type Face = { mouth: number; brow: number; lids: number; bags: number; puff: number; blush: number };
type Level = 0 | 1 | 2;
type Sample = {
  id: string; label: string; face: Face;
  mood: string; tone: "ok" | "warn" | "crit";
  eyes: Level; bags: Level; puff: Level;
  advice: string;
  survey: { mood: number; stress: number; fatigue: number; sleep_quality: number };
};

const SAMPLES: Sample[] = [
  {
    id: "happy", label: "Весёлый", face: { mouth: 1, brow: 0, lids: 0, bags: 0, puff: 0, blush: 1 },
    mood: "Весёлый, бодрый", tone: "ok", eyes: 0, bags: 0, puff: 0,
    advice: "Признаков усталости не видно. Отличный момент для сложных задач по плану.",
    survey: { mood: 9, stress: 2, fatigue: 2, sleep_quality: 8 },
  },
  {
    id: "calm", label: "Спокойный", face: { mouth: 0.25, brow: 0, lids: 0.2, bags: 0.25, puff: 0.2, blush: 0 },
    mood: "Спокойный", tone: "ok", eyes: 0, bags: 1, puff: 0,
    advice: "Состояние ровное. Лёгкие тени под глазами — не пропускайте окно сна сегодня.",
    survey: { mood: 7, stress: 3, fatigue: 3, sleep_quality: 7 },
  },
  {
    id: "tired", label: "Усталый", face: { mouth: -0.25, brow: -0.6, lids: 0.6, bags: 1, puff: 1, blush: 0 },
    mood: "Усталый", tone: "warn", eyes: 2, bags: 2, puff: 1,
    advice: "Похоже на недосып: тяжёлые веки и выраженные мешки. Отёк лица — типичный эффект смещения жидкости к голове в невесомости. Сегодня — полноценный сон 8,5 ч, тусклый свет за час до сна, без экрана перед сном.",
    survey: { mood: 5, stress: 4, fatigue: 8, sleep_quality: 3 },
  },
  {
    id: "angry", label: "Раздражённый", face: { mouth: -0.7, brow: 1, lids: 0.15, bags: 0.4, puff: 0.2, blush: 0 },
    mood: "Раздражённый, напряжён", tone: "crit", eyes: 1, bags: 1, puff: 0,
    advice: "Признаки напряжения: сведённые брови, сжатые губы. Сделайте паузу 5 минут, дыхание 4-7-8. Если так несколько дней подряд — поговорите с психологом на Земле, канал приватный.",
    survey: { mood: 3, stress: 8, fatigue: 5, sleep_quality: 5 },
  },
];

// Демо: шаблон выбирается по названию загруженного файла.
const NAME_KEYS: [RegExp, string][] = [
  [/весел|радост|happy|smile/, "happy"], [/спокой|calm|neutral/, "calm"],
  [/устал|сонн|tired|sleep/, "tired"], [/зл|раздраж|angry|mad/, "angry"],
];
function sampleByName(name: string): Sample | null {
  const n = name.toLowerCase().replace(/ё/g, "е");
  const id = NAME_KEYS.find(([re]) => re.test(n))?.[1];
  return SAMPLES.find((s) => s.id === id) ?? null;
}

const LEVEL_TEXT = { eyes: ["бодрые", "немного устали", "сильно устали"], bags: ["нет", "лёгкие", "выраженные"], puff: ["нет", "умеренная", "сильная"] };
const LEVEL_TONE = ["text-ok", "text-warn", "text-crit"];

/** Нарисованное лицо-пример: параметры мимики задают эмоцию. */
function FaceArt({ f, className = "" }: { f: Face; className?: string }) {
  const rx = 36 + f.puff * 4;
  const eyeRy = 4.6 * (1 - f.lids * 0.65);
  const browIn = 52 + f.brow * 5;
  const mouthY = 100;
  return (
    <svg viewBox="0 0 120 140" className={className} aria-hidden>
      <rect width="120" height="140" fill="#1b2230" />
      <path d="M22 140C26 118 42 112 60 112C78 112 94 118 98 140Z" fill="#2c4a7a" />
      <ellipse cx="60" cy="68" rx={rx} ry={46 + f.puff * 2} fill="#e3b892" />
      <path d={`M${60 - rx} 62C${60 - rx} 4 ${60 + rx} 4 ${60 + rx} 62C${60 + rx - 4} 46 ${60 - rx + 4} 46 ${60 - rx} 62Z`} fill="#4a3426" />
      {f.blush > 0 && <><circle cx="38" cy="84" r="6" fill="#e88" opacity={0.35 * f.blush} /><circle cx="82" cy="84" r="6" fill="#e88" opacity={0.35 * f.blush} /></>}
      {[44, 76].map((x) => (
        <g key={x}>
          {f.bags > 0 && <path d={`M${x - 8} 72Q${x} ${78 + f.bags * 2} ${x + 8} 72`} stroke="#7a5068" strokeWidth={2 + f.bags * 2} fill="none" opacity={0.25 + f.bags * 0.35} strokeLinecap="round" />}
          <ellipse cx={x} cy="66" rx="7" ry={eyeRy} fill="#fff" />
          <circle cx={x} cy={66 + f.lids * 1.5} r={Math.min(2.8, eyeRy)} fill="#2a2a35" />
          <path d={`M${x - 7.5} ${66 - eyeRy + 0.5}Q${x} ${66 - eyeRy - 2 + f.lids * 2} ${x + 7.5} ${66 - eyeRy + 0.5}`} stroke="#8a5e45" strokeWidth="1.6" fill="none" />
        </g>
      ))}
      <path d={`M34 ${52 - f.brow * 1}L52 ${browIn}`} stroke="#4a3426" strokeWidth="3" strokeLinecap="round" />
      <path d={`M86 ${52 - f.brow * 1}L68 ${browIn}`} stroke="#4a3426" strokeWidth="3" strokeLinecap="round" />
      <path d="M60 70V84Q58 87 55 86" stroke="#b98b6a" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <path d={`M46 ${mouthY}Q60 ${mouthY + f.mouth * 11} 74 ${mouthY}`} stroke="#9c4d4d" strokeWidth="2.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// «точки лица» для анимации сканирования
const LANDMARKS: [number, number][] = [
  [44, 66], [76, 66], [37, 66], [51, 66], [69, 66], [83, 66], [34, 52], [52, 54], [68, 54], [86, 52], [60, 72], [60, 84],
  [46, 100], [74, 100], [60, 103], [28, 70], [92, 70], [32, 92], [88, 92], [45, 108], [75, 108], [60, 114], [44, 74], [76, 74],
];

function Meter({ label, level, text }: { label: string; level: Level; text: string }) {
  return (
    <div>
      <div className="flex justify-between text-sm"><span className="text-muted">{label}</span><span className={`font-medium ${LEVEL_TONE[level]}`}>{text}</span></div>
      <div className="mt-1 grid grid-cols-3 gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className={`h-1.5 rounded-full ${i <= level ? (level === 0 ? "bg-ok" : level === 1 ? "bg-warn" : "bg-crit") : "bg-white/[0.07]"}`} />
        ))}
      </div>
    </div>
  );
}

export function FaceCheck({ onApply }: { onApply: (v: Sample["survey"]) => void }) {
  const [pick, setPick] = useState<Sample | null>(null);
  const [upload, setUpload] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "scan" | "done">("idle");
  const [applied, setApplied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (upload) URL.revokeObjectURL(upload); }, [upload]);

  const run = (s: Sample | null, url: string | null = null) => {
    setPick(s); setUpload(url); setApplied(false); setPhase("scan");
    window.setTimeout(() => setPhase("done"), 1600);
  };

  return (
    <Panel labelledBy="face-title">
      <PanelTitle id="face-title" icon={ScanFace}
        aside={<span className="rounded-full border border-warn/50 bg-warn/10 px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wider text-warn">ДЕМО</span>}>
        Фото лица · по желанию
      </PanelTitle>

      <p className="mb-4 flex gap-2 rounded-xl border border-warn/30 bg-warn/[0.06] p-3 text-sm text-muted">
        <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
        <span>Пример того, как будет работать функция: ИИ оценит по лицу настроение, усталость глаз, мешки и отёк. <b className="text-fg">Сейчас анализ имитирован</b> — для примеров ниже подготовлены готовые ответы. В полёте модель будет работать на бортовом компьютере, фото не покидает борт.</span>
      </p>

      <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
        <div className="face-frame relative mx-auto aspect-[6/7] w-full max-w-[220px] overflow-hidden rounded-2xl border border-white/10 bg-black/30 sm:max-w-none">
          {upload ? <img src={upload} alt="Загруженное фото" className="h-full w-full object-cover" />
            : pick ? <FaceArt f={pick.face} className="h-full w-full" />
            : <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-sm text-subtle"><Camera aria-hidden className="h-8 w-8" />Выберите пример или загрузите фото</div>}
          {phase === "scan" && (
            <div aria-hidden className="absolute inset-0">
              <svg viewBox="0 0 120 140" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
                {LANDMARKS.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.3" className="face-dot" style={{ animationDelay: `${i * 40}ms` }} />)}
              </svg>
              <div className="face-scanline" />
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {SAMPLES.map((s) => (
              <button key={s.id} type="button" onClick={() => run(s)} aria-pressed={pick?.id === s.id && !upload}
                className={`flex items-center gap-2 rounded-xl border p-1.5 pr-3 text-left text-sm transition-colors ${pick?.id === s.id && !upload
                  ? "border-accent/60 bg-accent/[0.1] text-fg" : "border-white/[0.07] bg-white/[0.02] text-muted hover:bg-white/[0.05] hover:text-fg"}`}>
                <FaceArt f={s.face} className="h-10 w-9 shrink-0 rounded-lg" />
                {s.label}
              </button>
            ))}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="sr-only" tabIndex={-1}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) run(sampleByName(f.name), URL.createObjectURL(f)); e.target.value = ""; }} />
          <Button variant="ghost" className="w-full" onClick={() => fileRef.current?.click()}>
            <Upload aria-hidden className="h-4 w-4" />Загрузить своё фото
          </Button>
        </div>
      </div>

      <div aria-live="polite">
        {phase === "scan" && (
          <p className="mt-4 flex items-center gap-2 text-sm text-accent"><Sparkles aria-hidden className="h-4 w-4 animate-pulse" />Анализ лица…</p>
        )}
        {phase === "done" && upload && !pick && (
          <div className="body-detail mt-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 text-sm text-muted">
            В этой демо-версии анализ работает только на примерах выше. Анализ ваших фото появится в следующей версии.
          </div>
        )}
        {phase === "done" && pick && (
          <div className="body-detail mt-4 space-y-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted">Настроение:</span>
              <span className={`text-lg font-semibold ${pick.tone === "ok" ? "text-ok" : pick.tone === "warn" ? "text-warn" : "text-crit"}`}>{pick.mood}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Meter label="Глаза" level={pick.eyes} text={LEVEL_TEXT.eyes[pick.eyes]} />
              <Meter label="Мешки" level={pick.bags} text={LEVEL_TEXT.bags[pick.bags]} />
              <Meter label="Отёк лица" level={pick.puff} text={LEVEL_TEXT.puff[pick.puff]} />
            </div>
            <p className="text-[15px] leading-relaxed">{pick.advice}</p>
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => { onApply(pick.survey); setApplied(true); }} disabled={applied}>
                <WandSparkles aria-hidden className="h-4 w-4" />{applied ? "Перенесено в опрос" : "Перенести в опрос"}
              </Button>
              <span className="text-xs text-subtle">Ползунки ниже можно поправить — последнее слово за вами.</span>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
