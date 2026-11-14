import { Play, RadioTower, RotateCcw, Square, Timer, WifiOff, Zap } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { api } from "../lib/api";
import { fmtDur } from "../lib/format";
import { useSnapshot } from "../lib/snapshot";
import { Button, PageSkeleton } from "./ui";

interface ScenarioInfo { id: string; title: string; description: string; target: string }

const SPEEDS = [1, 10, 60, 600];
const PROFILES = [["iss", "МКС"], ["moon", "Луна"], ["mars", "Марс"]] as const;

function Group({ icon: Icon, title, children }: { icon: typeof Timer; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">
        <Icon aria-hidden className="h-4 w-4" />{title}
      </h3>
      {children}
    </section>
  );
}

/**
 * Пульт сценариев (только для демо): ЧП одной кнопкой, скорость времени, связь с Землёй.
 * Живёт в выдвижной панели — доступен с любого экрана, без отдельной вкладки.
 */
export function DirectorPanel() {
  const { onboard } = useSnapshot();
  const [scenarios, setScenarios] = useState<ScenarioInfo[]>([]);
  const [astro, setAstro] = useState("a3");
  const [module, setModule] = useState("lab");
  const astroId = useId();
  const moduleId = useId();

  useEffect(() => {
    api.get<ScenarioInfo[]>("/api/director/scenarios").then(setScenarios).catch(() => {});
  }, []);
  if (!onboard) return <PageSkeleton />;

  const start = (s: ScenarioInfo) =>
    api.post(`/api/director/scenario/${s.id}`, { target: s.target === "astronaut" ? astro : s.target === "module" ? module : null });
  const targetLabel = (s: ScenarioInfo) =>
    s.target === "astronaut" ? onboard.crew.find((c) => c.id === astro)?.name
      : s.target === "module" ? onboard.modules.find((m) => m.id === module)?.name
        : s.target === "link" ? "канал связи" : "весь корабль";
  const select = "min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-[15px]";

  return (
    <div className="space-y-7">
      <p className="text-sm text-muted">Все данные — мок: симулятор генерирует показатели, сценарии накладывают ЧП.</p>

      <Group icon={Timer} title="Скорость времени">
        <div role="group" aria-label="Скорость времени" className="grid grid-cols-4 gap-2">
          {SPEEDS.map((s) => (
            <Button key={s} variant="segment" pressed={onboard.speed === s} className="num"
              onClick={() => api.post("/api/director/clock", { speed: s })}>×{s}</Button>
          ))}
        </div>
      </Group>

      <Group icon={RadioTower} title="Связь с Землёй">
        <div role="group" aria-label="Связь с Землёй" className="grid grid-cols-3 gap-2">
          {PROFILES.map(([p, label]) => (
            <Button key={p} variant="segment" pressed={onboard.link.profile === p} onClick={() => api.post("/api/director/link", { profile: p })}>{label}</Button>
          ))}
        </div>
        <Button className="w-full" variant={onboard.link.manual_up ? "default" : "danger"}
          onClick={() => api.post("/api/director/link", { up: !onboard.link.manual_up })}>
          {onboard.link.manual_up ? <><WifiOff aria-hidden className="h-4 w-4" />Оборвать связь</> : <><RadioTower aria-hidden className="h-4 w-4" />Восстановить связь</>}
        </Button>
      </Group>

      <Group icon={Zap} title="Сценарии ЧП">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={astroId} className="mb-1 block text-xs text-subtle">Астронавт</label>
            <select id={astroId} value={astro} onChange={(e) => setAstro(e.target.value)} className={select}>
              {onboard.crew.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor={moduleId} className="mb-1 block text-xs text-subtle">Модуль</label>
            <select id={moduleId} value={module} onChange={(e) => setModule(e.target.value)} className={select}>
              {onboard.modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        </div>
        <ul className="stagger space-y-2">
          {scenarios.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => start(s)}
                className="group flex w-full cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left transition-[border-color,background-color,transform] duration-200 hover:-translate-y-px hover:border-accent/60 hover:bg-accent/[0.06]">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent transition-colors group-hover:bg-accent group-hover:text-white">
                  <Play aria-hidden className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-medium">{s.title}<span className="ml-2 text-xs font-normal text-subtle">→ {targetLabel(s)}</span></span>
                  <span className="mt-0.5 block text-sm text-muted">{s.description}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {onboard.scenarios.length > 0 && (
          <div className="space-y-2 rounded-xl border border-warn/30 bg-warn/[0.06] p-3" aria-live="polite">
            <p className="text-sm font-medium text-warn">Идут сейчас</p>
            <ul className="flex flex-wrap gap-2">
              {onboard.scenarios.map((s) => (
                <li key={s.uid} className="inline-flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1 text-sm">
                  {s.title}{s.target ? ` · ${s.target}` : ""} · <span className="num">{fmtDur(s.elapsed_s)}</span>
                  {s.recovering && <span className="text-ok">· восстановление</span>}
                </li>
              ))}
            </ul>
            <Button variant="ghost" onClick={() => api.post("/api/director/scenarios/stop")}><Square aria-hidden className="h-4 w-4" />Остановить все</Button>
          </div>
        )}
      </Group>

      <Button variant="ghost" className="w-full" onClick={() => {
        if (window.confirm("Сбросить симуляцию? Все тревоги и история будут удалены.")) api.post("/api/director/reset");
      }}>
        <RotateCcw aria-hidden className="h-4 w-4" />Сбросить симуляцию
      </Button>
    </div>
  );
}
