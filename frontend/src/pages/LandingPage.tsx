import { ArrowRight, Satellite } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { createLandingScene, isWideLayout, type LandingScene, type Phase } from "../landing/scene";

const readWide = () => isWideLayout(window.innerWidth, window.innerHeight);

// Вступление: проблема → задача → почему решать на борту
const CAPTIONS: Partial<Record<Phase, string>> = {
  caption1: "Долгие миссии — это радиация, невесомость и изоляция",
  caption2: "Изменения в организме астронавт должен заметить сам",
  caption3: "Ответ с Земли идёт до 22 минут — помощь нужна на борту",
};

// Наше решение: собрать → оценить → действовать
const PILLARS: { title: string; text: string }[] = [
  { title: "Собирает", text: "пульс, давление, SpO₂, сон, самочувствие и среду корабля" },
  { title: "Оценивает", text: "цветовой статус по системам организма, тренды и личная норма" },
  { title: "Подсказывает", text: "пошаговые протоколы и когда звать врача на Земле" },
];

/** Приветственный экран: 3D-сцена (планета, корабли, космос) и переход в приложение. */
export function LandingPage() {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<LandingScene | null>(null);
  const [phase, setPhase] = useState<Phase | "boot">("boot");
  const [noWebGL, setNoWebGL] = useState(false);
  const [wide, setWide] = useState(readWide);
  const final = phase === "final";

  useEffect(() => {
    const onResize = () => setWide(readWide());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const prevTitle = document.title;
    document.title = "AstroHealth — бортовая система здоровья экипажа";
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const startAt = Number(new URLSearchParams(window.location.search).get("t")) || 0;
    try {
      scene.current = createLandingScene(host.current!, { reducedMotion, startAt, onPhase: setPhase });
    } catch {
      setNoWebGL(true);
      setPhase("final");
    }
    return () => {
      scene.current?.dispose();
      scene.current = null;
      document.title = prevTitle;
    };
  }, []);

  const caption = CAPTIONS[phase as Phase];

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#05070b] text-fg">
      <div ref={host} aria-hidden className="absolute inset-0" />
      {noWebGL && <div aria-hidden className="landing-fallback absolute inset-0" />}

      {/* затемнение под текстом финального экрана — для контраста */}
      <div aria-hidden
        className={`pointer-events-none absolute inset-0 transition-opacity duration-[1600ms] ${wide ? "landing-scrim-wide" : "landing-scrim"} ${final ? "opacity-100" : "opacity-0"}`} />

      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-4 px-4 py-4 sm:px-8 sm:py-6">
        <span className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-strong/25 text-accent backdrop-blur">
            <Satellite aria-hidden className="h-5 w-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight">AstroHealth</span>
        </span>
        {!final && (
          <button type="button" onClick={() => scene.current?.skip()}
            className="min-h-11 rounded-xl border border-white/20 bg-black/30 px-4 text-sm text-muted backdrop-blur transition-colors hover:border-white/40 hover:text-fg">
            Пропустить
          </button>
        )}
      </header>

      {phase === "boot" && !noWebGL && (
        <div role="status" className="absolute inset-0 z-10 flex items-center justify-center">
          <span className="flex items-center gap-3 font-mono text-xs uppercase tracking-[0.2em] text-subtle">
            <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-white/15 border-t-accent" />
            Выход на орбиту…
          </span>
        </div>
      )}

      {/* подписи вступления */}
      <div aria-live="polite" className="pointer-events-none absolute inset-x-0 bottom-[16%] z-10 flex justify-center px-6">
        {caption && !final && (
          <p key={phase} className="landing-caption max-w-2xl text-center text-xl font-light tracking-wide text-fg/90 sm:text-3xl">
            {caption}
          </p>
        )}
      </div>

      {/* финальный экран */}
      {final && (
        <section aria-labelledby="landing-title"
          className={`absolute inset-0 z-10 flex ${wide ? "items-center" : "items-end"}`}>
          <div className={`w-full max-w-2xl ${wide ? "pl-20 pr-10" : "landing-narrow px-6 pb-10 sm:px-10 sm:pb-16"}`}>
            <p className="landing-rise landing-eyebrow font-mono text-xs font-semibold uppercase tracking-[0.2em] text-accent sm:text-sm"
              style={{ animationDelay: "0ms" }}>
              Мониторинг здоровья в долгих миссиях
            </p>
            <h1 id="landing-title"
              className="landing-rise landing-title mt-3 text-5xl font-semibold tracking-tight sm:text-7xl"
              style={{ animationDelay: "120ms" }}>
              AstroHealth
            </h1>
            <p className="landing-rise landing-lead mt-5 max-w-xl text-base text-muted sm:text-lg" style={{ animationDelay: "260ms" }}>
              Бортовой помощник, с которым астронавт сам оценивает своё здоровье и сразу понимает, что делать, — не дожидаясь ответа с Земли.
            </p>
            <ul className="landing-rise landing-pillars mt-7 grid gap-3 sm:grid-cols-3" style={{ animationDelay: "380ms" }}>
              {PILLARS.map((p, i) => (
                <li key={p.title} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur">
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
                    {String(i + 1).padStart(2, "0")} · {p.title}
                  </span>
                  <span className="mt-1 block text-sm leading-snug text-muted">{p.text}</span>
                </li>
              ))}
            </ul>
            <div className="landing-rise landing-cta-wrap mt-9" style={{ animationDelay: "520ms" }}>
              <Link to="/me/a3"
                className="landing-cta group inline-flex min-h-14 items-center gap-3 rounded-2xl bg-accent-strong px-7 text-lg font-semibold text-white transition-[background-color,box-shadow] hover:bg-[#1d4ed8]">
                Перейти к проекту
                <ArrowRight aria-hidden className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* авторство ассетов (CC BY 4.0 требует указания) */}
      {final && (
        <p className="landing-rise absolute bottom-2 right-3 z-10 text-[10px] text-subtle/70 sm:right-4"
          style={{ animationDelay: "900ms" }}>
          Текстуры Земли:{" "}
          <a href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
            Solar System Scope
          </a>{" "}
          (CC BY 4.0) · Модель МКС: NASA
        </p>
      )}
    </div>
  );
}
