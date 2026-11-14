import { Clapperboard, Play, RadioTower, RotateCcw, Square, Timer, WifiOff } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { Button, PageSkeleton, Panel, PanelTitle } from "../components/ui";
import { api } from "../lib/api";
import { fmtDur } from "../lib/format";
import { useSnapshot } from "../lib/snapshot";

interface ScenarioInfo { id: string; title: string; description: string; target: string }

const SPEEDS = [1, 10, 60, 600];
const PROFILES = [["iss", "МКС"], ["moon", "Луна"], ["mars", "Марс"]] as const;

/** Пульт сценариев для демо: ЧП одной кнопкой, скорость времени, связь. */
export function DirectorPanel({ compact = false }: { compact?: boolean }) {
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

  return (
    <div className="space-y-4">
      <Panel as="div" className="flex flex-wrap items-center gap-x-6 gap-y-4">
        <div role="group" aria-label="Скорость времени" className="flex flex-wrap items-center gap-2">
          <Timer aria-hidden className="h-5 w-5 text-subtle" />
          <span className="text-sm text-muted">Время</span>
          {SPEEDS.map((s) => (
            <Button key={s} variant="segment" pressed={onboard.speed === s} className="num min-w-14"
              onClick={() => api.post("/api/director/clock", { speed: s })}>×{s}</Button>
          ))}
        </div>
        <div role="group" aria-label="Связь с Землёй" className="flex flex-wrap items-center gap-2">
          <RadioTower aria-hidden className="h-5 w-5 text-subtle" />
          <span className="text-sm text-muted">Связь</span>
          {PROFILES.map(([p, label]) => (
            <Button key={p} variant="segment" pressed={onboard.link.profile === p} onClick={() => api.post("/api/director/link", { profile: p })}>{label}</Button>
          ))}
          <Button variant={onboard.link.manual_up ? "default" : "danger"} onClick={() => api.post("/api/director/link", { up: !onboard.link.manual_up })}>
            {onboard.link.manual_up ? <><WifiOff aria-hidden className="h-4 w-4" />Оборвать</> : <><RadioTower aria-hidden className="h-4 w-4" />Восстановить</>}
          </Button>
        </div>
        <Button variant="ghost" className="lg:ml-auto" onClick={() => {
          if (window.confirm("Сбросить симуляцию? Все тревоги и история будут удалены.")) api.post("/api/director/reset");
        }}>
          <RotateCcw aria-hidden className="h-4 w-4" />Сброс
        </Button>
      </Panel>

      <Panel labelledBy="scen-title">
        <PanelTitle id="scen-title" icon={Clapperboard}>Сценарии ЧП</PanelTitle>
        <div className="mb-4 flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor={astroId} className="text-sm text-muted">Астронавт</label>
            <select id={astroId} value={astro} onChange={(e) => setAstro(e.target.value)}
              className="min-h-11 rounded-xl border border-control/70 bg-bg px-3 text-[15px]">
              {onboard.crew.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor={moduleId} className="text-sm text-muted">Модуль</label>
            <select id={moduleId} value={module} onChange={(e) => setModule(e.target.value)}
              className="min-h-11 rounded-xl border border-control/70 bg-bg px-3 text-[15px]">
              {onboard.modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        </div>
        <ul className={`grid gap-2 ${compact ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5" : "sm:grid-cols-2 xl:grid-cols-3"}`}>
          {scenarios.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => start(s)}
                className="group flex h-full min-h-14 w-full cursor-pointer items-start gap-3 rounded-xl border border-control/60 bg-bg/60 p-3 text-left transition-colors hover:border-accent">
                <Play aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <span className="min-w-0">
                  <span className="block text-[15px] font-medium">{s.title}</span>
                  <span className="block text-xs text-subtle">→ {targetLabel(s)}</span>
                  {!compact && <span className="mt-1 block text-sm text-muted">{s.description}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {onboard.scenarios.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4" aria-live="polite">
            <span className="text-sm text-muted">Идут сейчас:</span>
            {onboard.scenarios.map((s) => (
              <span key={s.uid} className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-sm">
                {s.title}{s.target ? ` · ${s.target}` : ""} · <span className="num">{fmtDur(s.elapsed_s)}</span>
                {s.recovering && <span className="text-ok">· восстановление</span>}
              </span>
            ))}
            <Button variant="ghost" onClick={() => api.post("/api/director/scenarios/stop")}><Square aria-hidden className="h-4 w-4" />Остановить все</Button>
          </div>
        )}
      </Panel>
    </div>
  );
}

export function DirectorPage() {
  return (
    <>
      <PageHeader eyebrow="Только для демо" title="Пульт сценариев">
        Все данные — мок: симулятор генерирует показатели, сценарии накладывают ЧП.
      </PageHeader>
      <DirectorPanel />
    </>
  );
}
