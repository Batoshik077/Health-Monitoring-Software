import { Globe, Rocket } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { DirectorPanel } from "./DirectorPage";
import { GroundView } from "./GroundPage";
import { MeView } from "./MePage";

/** Разделённый экран для питча: слева борт (астронавт), справа Земля. */
export function DemoPage() {
  return (
    <>
      <PageHeader eyebrow="Экран для питча" title="Борт решает сам, Земля видит с задержкой" />
      <div className="space-y-6">
        <DirectorPanel compact />
        <div className="grid gap-8 2xl:grid-cols-2">
          <section aria-labelledby="side-onboard">
            <p id="side-onboard" className="mb-3 inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-accent">
              <Rocket aria-hidden className="h-4 w-4" />Борт · видит сразу
            </p>
            <MeView id="a3" compact />
          </section>
          <section aria-labelledby="side-ground" className="2xl:border-l 2xl:border-line 2xl:pl-8">
            <p id="side-ground" className="mb-3 inline-flex items-center gap-2 rounded-full bg-warn/15 px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-warn">
              <Globe aria-hidden className="h-4 w-4" />Земля · видит с задержкой
            </p>
            <GroundView compact />
          </section>
        </div>
      </div>
    </>
  );
}
