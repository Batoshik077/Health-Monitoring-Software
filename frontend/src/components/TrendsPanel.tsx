import { LineChart as ChartIcon } from "lucide-react";
import type { Astronaut, HistoryPoint } from "../lib/types";
import { LiveChart } from "./LiveChart";
import { Panel, PanelTitle } from "./ui";

/** Графики за окно истории. Отдельный модуль: recharts грузится лениво, только когда панель на экране. */
export default function TrendsPanel({ a, history, nowT, windowMin }: {
  a: Astronaut; history: HistoryPoint[]; nowT: number; windowMin: number;
}) {
  const band = (k: string) => a.baseline[k] && {
    low: +(a.baseline[k].mean - 2 * a.baseline[k].std).toFixed(1),
    high: +(a.baseline[k].mean + 2 * a.baseline[k].std).toFixed(1),
    label: "личная норма",
  };
  return (
    <Panel labelledBy={`charts-${a.id}`}>
      <PanelTitle id={`charts-${a.id}`} icon={ChartIcon}>Динамика за {windowMin >= 60 ? `${windowMin / 60} ч` : `${windowMin} мин`}</PanelTitle>
      <div className="grid gap-6 lg:grid-cols-2">
        <LiveChart data={history} metric="hr" label="Пульс" unit="уд/мин" nowT={nowT} band={band("hr") || undefined} />
        <LiveChart data={history} metric="spo2" label="SpO₂" unit="%" nowT={nowT} domain={[80, 100]}
          threshold={{ value: 88, label: "критический порог 88 %" }} />
        <LiveChart data={history} metric="rr" label="Частота дыхания" unit="/мин" nowT={nowT} band={band("rr") || undefined} />
        <LiveChart data={history} metric="readiness" label="Индекс готовности" unit="из 100" nowT={nowT} domain={[0, 100]} />
      </div>
    </Panel>
  );
}
