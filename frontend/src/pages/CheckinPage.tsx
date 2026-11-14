import { CircleCheck, ClipboardCheck } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaceCheck } from "../components/FaceCheck";
import { PageHeader } from "../components/PageHeader";
import { Button, Panel, PanelTitle } from "../components/ui";
import { api } from "../lib/api";
import { useSnapshot } from "../lib/snapshot";

const SLIDERS = [
  { key: "mood", label: "Настроение", low: "плохое", high: "отличное", def: 7 },
  { key: "stress", label: "Стресс", low: "спокойно", high: "очень сильный", def: 3 },
  { key: "fatigue", label: "Усталость", low: "бодрость", high: "без сил", def: 3 },
  { key: "sleep_quality", label: "Качество сна", low: "не выспался", high: "отлично", def: 7 },
] as const;

const SYMPTOMS = ["Головная боль", "Тошнота", "Насморк или кашель", "Боль в мышцах или спине",
  "Ухудшение зрения", "Сыпь или долго заживающая рана", "Головокружение"];

/** Ежедневная самопроверка: 30 секунд — опросник, симптомы, тренировка. */
export function CheckinPage() {
  const { id = "a3" } = useParams();
  const { onboard } = useSnapshot();
  const navigate = useNavigate();
  const [values, setValues] = useState<Record<string, number>>(Object.fromEntries(SLIDERS.map((s) => [s.key, s.def])));
  const [symptoms, setSymptoms] = useState<Set<string>>(new Set());
  const [exercise, setExercise] = useState(0);
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const name = onboard?.crew.find((c) => c.id === id)?.name ?? id;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("busy");
    try {
      await api.post("/api/surveys", { astronaut_id: id, ...values });
      for (const kind of symptoms) await api.post("/api/symptoms", { astronaut_id: id, kind, severity: 2 });
      if (exercise > 0) await api.post("/api/exercise", { astronaut_id: id, minutes: exercise, type: "mixed" });
      setState("done");
      setTimeout(() => navigate(`/me/${id}`), 900);
    } catch {
      setState("error");
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl">
      <PageHeader eyebrow="Ежедневно · 30 секунд" title="Самопроверка">{name}: как вы себя чувствуете сегодня?</PageHeader>
      <div className="space-y-5">
        <FaceCheck onApply={(v) => setValues({ ...values, ...v })} />
        <Panel labelledBy="mood-title">
          <PanelTitle id="mood-title" icon={ClipboardCheck}>Самочувствие</PanelTitle>
          <div className="space-y-5">
            {SLIDERS.map((s) => (
              <div key={s.key}>
                <div className="flex items-baseline justify-between">
                  <label htmlFor={`sl-${s.key}`} className="text-[15px] font-medium">{s.label}</label>
                  <output htmlFor={`sl-${s.key}`} className="num text-lg font-semibold">{values[s.key]}<span className="text-sm text-subtle">/10</span></output>
                </div>
                <input id={`sl-${s.key}`} type="range" min={0} max={10} value={values[s.key]} className="w-full cursor-pointer"
                  aria-describedby={`sl-${s.key}-hint`} onChange={(e) => setValues({ ...values, [s.key]: Number(e.target.value) })} />
                <div id={`sl-${s.key}-hint`} className="flex justify-between text-sm text-subtle"><span>0 — {s.low}</span><span>10 — {s.high}</span></div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <fieldset>
            <legend className="mb-1 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-muted">Симптомы</legend>
            <p className="mb-4 text-sm text-subtle">Отметьте всё, что беспокоит. Можно ничего не отмечать.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {SYMPTOMS.map((s) => {
                const on = symptoms.has(s);
                return (
                  <button key={s} type="button" aria-pressed={on} onClick={() => {
                    const next = new Set(symptoms);
                    if (on) next.delete(s); else next.add(s);
                    setSymptoms(next);
                  }} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 text-left text-[15px] transition-colors ${on
                    ? "border-warn bg-warn/10 text-fg" : "border-control/60 bg-bg/60 text-muted hover:text-fg"}`}>
                    <span aria-hidden className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${on ? "border-warn bg-warn text-bg" : "border-control"}`}>
                      {on && "✓"}
                    </span>
                    {s}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </Panel>

        <Panel>
          <fieldset>
            <legend className="mb-4 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-muted">Тренировка вне расписания</legend>
            <div className="flex flex-wrap gap-2">
              {[0, 30, 45, 60].map((m) => (
                <Button key={m} variant="segment" pressed={exercise === m} onClick={() => setExercise(m)}>
                  {m === 0 ? "Не было" : `${m} мин`}
                </Button>
              ))}
            </div>
          </fieldset>
        </Panel>

        <div aria-live="polite" className="min-h-6 text-[15px]">
          {state === "done" && <p className="inline-flex items-center gap-2 text-ok"><CircleCheck aria-hidden className="h-5 w-5" />Сохранено. Возвращаемся на «Моё здоровье»…</p>}
          {state === "error" && <p role="alert" className="text-crit">Не удалось отправить: нет связи с бортовым сервером. Проверьте соединение и нажмите «Отправить» ещё раз.</p>}
        </div>
        <Button type="submit" variant="primary" busy={state === "busy"} disabled={state === "done"} className="w-full min-h-12 text-base">
          {state === "busy" ? "Отправляем…" : "Отправить"}
        </Button>
      </div>
    </form>
  );
}
