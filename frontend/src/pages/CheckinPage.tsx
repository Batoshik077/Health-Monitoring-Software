import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Card, SectionTitle } from "../components/ui";
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
  const [symptoms, setSymptoms] = useState<Record<string, number>>({});
  const [exercise, setExercise] = useState(0);
  const [busy, setBusy] = useState(false);
  const name = onboard?.crew.find((c) => c.id === id)?.name ?? id;

  const submit = async () => {
    setBusy(true);
    try {
      await api.post("/api/surveys", { astronaut_id: id, ...values });
      for (const [kind, severity] of Object.entries(symptoms)) {
        await api.post("/api/symptoms", { astronaut_id: id, kind, severity });
      }
      if (exercise > 0) await api.post("/api/exercise", { astronaut_id: id, minutes: exercise, type: "mixed" });
      navigate(`/me/${id}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Самопроверка · {name}</h1>
      <Card>
        <SectionTitle>Как вы себя чувствуете?</SectionTitle>
        <div className="space-y-4">
          {SLIDERS.map((s) => (
            <label key={s.key} className="block">
              <div className="flex justify-between text-sm">
                <span>{s.label}</span>
                <span className="font-bold tabular-nums">{values[s.key]}/10</span>
              </div>
              <input type="range" min={0} max={10} value={values[s.key]} className="w-full accent-sky-500"
                onChange={(e) => setValues({ ...values, [s.key]: Number(e.target.value) })} />
              <div className="flex justify-between text-[11px] text-slate-500"><span>{s.low}</span><span>{s.high}</span></div>
            </label>
          ))}
        </div>
      </Card>
      <Card>
        <SectionTitle>Симптомы</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-2">
          {SYMPTOMS.map((s) => {
            const on = s in symptoms;
            return (
              <button key={s} onClick={() => {
                const next = { ...symptoms };
                if (on) delete next[s]; else next[s] = 2;
                setSymptoms(next);
              }} className={`rounded-lg border px-3 py-2 text-left text-sm ${on ? "border-amber-400 bg-amber-950/40" : "border-slate-800 bg-slate-950/50"}`}>
                {on ? "✓ " : ""}{s}
              </button>
            );
          })}
        </div>
      </Card>
      <Card>
        <SectionTitle>Тренировка вне расписания</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {[0, 30, 45, 60].map((m) => (
            <button key={m} onClick={() => setExercise(m)}
              className={`rounded-lg px-3 py-2 text-sm ${exercise === m ? "bg-sky-700" : "bg-slate-800"}`}>
              {m === 0 ? "не было" : `${m} мин`}
            </button>
          ))}
        </div>
      </Card>
      <Button variant="primary" onClick={submit} disabled={busy} className="w-full py-3 text-base">Отправить</Button>
    </div>
  );
}
