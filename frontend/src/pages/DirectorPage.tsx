import { useEffect, useState } from "react";
import { Button, Card, Loading, SectionTitle } from "../components/ui";
import { api } from "../lib/api";
import { fmtDur } from "../lib/format";
import { useSnapshot } from "../lib/snapshot";

interface ScenarioInfo { id: string; title: string; description: string; target: string }

const SPEEDS = [1, 10, 60, 600];

/** Пульт сценариев для демо: ЧП одной кнопкой, скорость времени, связь. */
export function DirectorPanel({ compact = false }: { compact?: boolean }) {
  const { onboard } = useSnapshot();
  const [scenarios, setScenarios] = useState<ScenarioInfo[]>([]);
  const [astro, setAstro] = useState("a3");
  const [module, setModule] = useState("lab");

  useEffect(() => {
    api.get<ScenarioInfo[]>("/api/director/scenarios").then(setScenarios).catch(() => {});
  }, []);
  if (!onboard) return <Loading />;

  const start = (s: ScenarioInfo) =>
    api.post(`/api/director/scenario/${s.id}`, { target: s.target === "astronaut" ? astro : s.target === "module" ? module : null });

  return (
    <div className="space-y-3">
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-slate-400">Скорость времени:</span>
          {SPEEDS.map((s) => (
            <Button key={s} variant={onboard.speed === s ? "primary" : "default"} onClick={() => api.post("/api/director/clock", { speed: s })}>×{s}</Button>
          ))}
          <span className="mx-2 h-6 w-px bg-slate-700" />
          <span className="text-sm text-slate-400">Связь:</span>
          <Button variant={onboard.link.manual_up ? "default" : "danger"}
            onClick={() => api.post("/api/director/link", { up: !onboard.link.manual_up })}>
            {onboard.link.manual_up ? "Оборвать" : "Восстановить"}
          </Button>
          {["iss", "moon", "mars"].map((p) => (
            <Button key={p} variant={onboard.link.profile === p ? "primary" : "ghost"} onClick={() => api.post("/api/director/link", { profile: p })}>
              {{ iss: "МКС", moon: "Луна", mars: "Марс" }[p]}
            </Button>
          ))}
          <Button variant="ghost" className="ml-auto" onClick={() => api.post("/api/director/reset")}>Сброс</Button>
        </div>
      </Card>
      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
          <SectionTitle>Сценарии ЧП</SectionTitle>
          <label className="ml-auto">Астронавт:{" "}
            <select value={astro} onChange={(e) => setAstro(e.target.value)} className="rounded bg-slate-800 px-2 py-1">
              {onboard.crew.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label>Модуль:{" "}
            <select value={module} onChange={(e) => setModule(e.target.value)} className="rounded bg-slate-800 px-2 py-1">
              {onboard.modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
        </div>
        <div className={`grid gap-2 ${compact ? "grid-cols-2 md:grid-cols-5" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
          {scenarios.map((s) => (
            <button key={s.id} onClick={() => start(s)}
              className="rounded-lg border border-slate-700 bg-slate-950/50 p-3 text-left hover:border-sky-500">
              <div className="text-sm font-semibold">{s.title}</div>
              {!compact && <div className="text-xs text-slate-400">{s.description}</div>}
            </button>
          ))}
        </div>
        {onboard.scenarios.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400">Активны:</span>
            {onboard.scenarios.map((s) => (
              <span key={s.uid} className="rounded-full bg-slate-800 px-2 py-1">
                {s.title}{s.target ? ` → ${s.target}` : ""} · {fmtDur(s.elapsed_s)}{s.recovering ? " · восстановление" : ""}
              </span>
            ))}
            <Button variant="ghost" onClick={() => api.post("/api/director/scenarios/stop")}>Остановить все</Button>
          </div>
        )}
      </Card>
    </div>
  );
}

export function DirectorPage() {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">Пульт сценариев</h1>
      <p className="text-sm text-slate-400">Только для демо. Данные мок: симулятор генерирует показатели, сценарии накладывают ЧП.</p>
      <DirectorPanel />
    </div>
  );
}
