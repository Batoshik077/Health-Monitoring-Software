import { DirectorPanel } from "./DirectorPage";
import { GroundView } from "./GroundPage";
import { MeView } from "./MePage";

/** Разделённый экран для питча: слева борт (астронавт), справа Земля. */
export function DemoPage() {
  return (
    <div className="space-y-4">
      <DirectorPanel compact />
      <div className="grid gap-6 xl:grid-cols-2">
        <section>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-sky-300">🚀 Борт · видит сразу</div>
          <MeView id="a3" compact />
        </section>
        <section className="xl:border-l xl:border-slate-800 xl:pl-6">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-300">🌍 Земля · видит с задержкой</div>
          <GroundView compact />
        </section>
      </div>
    </div>
  );
}
