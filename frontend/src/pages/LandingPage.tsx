import { ArrowRight, Headphones, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createLandingScene, isWideLayout, type LandingScene, type Phase } from "../landing/scene";
import { LandingSound } from "../landing/sound";
import { LangSwitch, useT } from "../lib/i18n";

const readWide = () => isWideLayout(window.innerWidth, window.innerHeight);
const LOGO = `${import.meta.env.BASE_URL}brand/astrohealth-logo-256.png`;
const LOGO_SMALL = `${import.meta.env.BASE_URL}brand/astrohealth-logo-128.png`;
const APP_ENTRY = "/me/a3";
const DEPART_MS = 2400; // длительность перехода в бортовой компьютер

const SOUND_KEY = "astrohealth.landing.sound";
const readSoundPref = () => {
  try { return localStorage.getItem(SOUND_KEY) === "1"; } catch { return false; }
};
const saveSoundPref = (on: boolean) => {
  try { localStorage.setItem(SOUND_KEY, on ? "1" : "0"); } catch { /* приватный режим — не страшно */ }
};

type Strings = {
  docTitle: string;
  loading: string;
  skip: string;
  soundOn: string;
  soundOff: string;
  soundHint: string;
  /** Вступление: проблема → задача → почему решать на борту */
  captions: Partial<Record<Phase, string>>;
  eyebrow: string;
  lead: string;
  /** Наше решение: собрать → оценить → действовать */
  pillars: { title: string; text: string }[];
  cta: string;
  credits: { textures: string; iss: string };
  /** Строки экрана «стыковки» — появляются по очереди */
  boot: string[];
};

const DICT: { ru: Strings; en: Strings } = {
  ru: {
    docTitle: "AstroHealth — бортовая система здоровья экипажа",
    loading: "Выход на орбиту…",
    skip: "Пропустить",
    soundOn: "Включить звук",
    soundOff: "Выключить звук",
    soundHint: "Включить звук",
    captions: {
      caption1: "Долгие миссии — это радиация, невесомость и изоляция",
      caption2: "Изменения в организме астронавт должен заметить сам",
      caption3: "Ответ с Земли идёт до 22 минут — помощь нужна на борту",
    },
    eyebrow: "Мониторинг здоровья в долгих миссиях",
    lead: "Бортовой помощник, с которым астронавт сам оценивает своё здоровье и сразу понимает, что делать, — не дожидаясь ответа с Земли.",
    pillars: [
      { title: "Собирает", text: "пульс, давление, SpO₂, сон, самочувствие и среду корабля" },
      { title: "Оценивает", text: "цветовой статус по системам организма, тренды и личная норма" },
      { title: "Подсказывает", text: "пошаговые протоколы и когда звать врача на Земле" },
    ],
    cta: "Перейти к проекту",
    credits: { textures: "Текстуры Земли", iss: "Модель МКС: NASA" },
    boot: ["Стыковка с бортовым компьютером", "Синхронизация телеметрии экипажа", "Доступ к системам разрешён"],
  },
  en: {
    docTitle: "AstroHealth — onboard crew health system",
    loading: "Entering orbit…",
    skip: "Skip",
    soundOn: "Turn sound on",
    soundOff: "Mute sound",
    soundHint: "Turn on sound",
    captions: {
      caption1: "Long missions mean radiation, microgravity and isolation",
      caption2: "Astronauts have to notice changes in their own bodies",
      caption3: "A reply from Earth takes up to 22 minutes — help has to be on board",
    },
    eyebrow: "Health monitoring for long-duration missions",
    lead: "An onboard assistant that lets astronauts assess their own health and know what to do right away — without waiting for Earth.",
    pillars: [
      { title: "Gathers", text: "heart rate, blood pressure, SpO₂, sleep, wellbeing and the cabin environment" },
      { title: "Evaluates", text: "color-coded status by body system, trends and a personal baseline" },
      { title: "Guides", text: "step-by-step protocols and when to call the flight surgeon" },
    ],
    cta: "Open the project",
    credits: { textures: "Earth textures", iss: "ISS model: NASA" },
    boot: ["Docking with the onboard computer", "Syncing crew telemetry", "Systems access granted"],
  },
};

/** Приветственный экран: 3D-сцена (планета, корабли, космос) и переход в приложение. */
export function LandingPage() {
  const t = useT(DICT);
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<LandingScene | null>(null);
  const [phase, setPhase] = useState<Phase | "boot">("boot");
  const [noWebGL, setNoWebGL] = useState(false);
  const [wide, setWide] = useState(readWide);
  const sound = useRef<LandingSound | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const final = phase === "final";
  const navigate = useNavigate();
  const [leaving, setLeaving] = useState(false);
  const leaveTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(leaveTimer.current), []);

  /** «Перейти к проекту»: камера ныряет к МКС, экран стыковки, затем приложение. */
  const goToApp = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // открыть в новой вкладке — как обычно
    e.preventDefault();
    if (leaving) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setLeaving(true);
    scene.current?.depart();
    sound.current?.cue("depart");
    leaveTimer.current = window.setTimeout(
      () => navigate(APP_ENTRY, { state: { fromLanding: true } }),
      reduced ? 350 : DEPART_MS,
    );
  };

  const toggleSound = () => {
    const s = (sound.current ??= new LandingSound());
    const next = !s.enabled;
    if (next) void s.enable();
    else s.disable();
    setSoundOn(next);
    saveSoundPref(next);
  };

  // звук был включён в прошлый раз: включаем при первом же действии пользователя (иначе браузер не даст)
  useEffect(() => {
    if (!readSoundPref()) return;
    const unlock = () => {
      if (!sound.current?.enabled) toggleSound();
      cleanup();
    };
    const cleanup = () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => sound.current?.dispose(), []);

  useEffect(() => {
    const onResize = () => setWide(readWide());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // заголовок вкладки — на текущем языке; при уходе со страницы возвращаем прежний
  const prevTitle = useRef(document.title);
  useEffect(() => {
    document.title = t.docTitle;
  }, [t]);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const startAt = Number(new URLSearchParams(window.location.search).get("t")) || 0;
    try {
      scene.current = createLandingScene(host.current!, {
        reducedMotion, startAt, onPhase: setPhase,
        onCue: (c) => sound.current?.cue(c),
        onAudioFrame: (f) => sound.current?.update(f),
      });
    } catch {
      setNoWebGL(true);
      setPhase("final");
    }
    return () => {
      scene.current?.dispose();
      scene.current = null;
      document.title = prevTitle.current;
    };
  }, []);

  const caption = t.captions[phase as Phase];
  const btn = "border border-white/20 bg-black/30 text-muted backdrop-blur transition-colors hover:border-white/40 hover:text-fg";

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#05070b] text-fg">
      <div ref={host} aria-hidden className="absolute inset-0" />
      {noWebGL && <div aria-hidden className="landing-fallback absolute inset-0" />}

      {/* затемнение под текстом финального экрана — для контраста */}
      <div aria-hidden
        className={`pointer-events-none absolute inset-0 transition-opacity duration-[1600ms] ${wide ? "landing-scrim-wide" : "landing-scrim"} ${final ? "opacity-100" : "opacity-0"}`} />

      {/* z-20: шапка выше полноэкранного финального слоя (z-10), иначе он перехватывает клики по её кнопкам */}
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 px-4 py-4 sm:px-8 sm:py-6">
        <span className="flex items-center gap-2.5">
          <img src={LOGO_SMALL} alt="" aria-hidden width={40} height={40}
            className="h-10 w-10 rounded-full shadow-[0_0_18px_-4px_rgb(96_165_250/0.7)]" />
          <span className="hidden text-lg font-semibold tracking-tight min-[400px]:inline">AstroHealth</span>
        </span>
        <div className="flex items-center gap-2">
          <LangSwitch />
          <button type="button" onClick={toggleSound} aria-pressed={soundOn}
            aria-label={soundOn ? t.soundOff : t.soundOn} title={soundOn ? t.soundOff : t.soundOn}
            className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${btn}`}>
            {soundOn ? <Volume2 aria-hidden className="h-5 w-5" /> : <VolumeX aria-hidden className="h-5 w-5" />}
          </button>
          {!final && (
            <button type="button" onClick={() => scene.current?.skip()} className={`min-h-11 rounded-xl px-4 text-sm ${btn}`}>
              {t.skip}
            </button>
          )}
        </div>
      </header>

      {/* приглашение включить звук — во время вступления, пока звук выключен */}
      {!soundOn && !final && !noWebGL && (
        <div className="absolute inset-x-0 bottom-[5%] z-10 flex justify-center px-6">
          <button type="button" onClick={toggleSound}
            className="landing-sound-hint inline-flex min-h-11 items-center gap-2.5 rounded-full border border-white/20 bg-black/40 px-5 text-sm text-fg/90 backdrop-blur transition-colors hover:border-white/40">
            <Headphones aria-hidden className="h-4 w-4 text-accent" />
            {t.soundHint}
          </button>
        </div>
      )}

      {phase === "boot" && !noWebGL && (
        <div role="status" className="absolute inset-0 z-10 flex items-center justify-center">
          <span className="flex items-center gap-3 font-mono text-xs uppercase tracking-[0.2em] text-subtle">
            <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-white/15 border-t-accent" />
            {t.loading}
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
          className={`absolute inset-0 z-10 flex ${wide ? "items-center" : "items-end"} ${leaving ? "landing-leave" : ""}`}>
          <div className={`w-full max-w-2xl ${wide ? "pl-20 pr-10" : "landing-narrow px-6 pb-10 sm:px-10 sm:pb-16"}`}>
            <div className="landing-rise flex items-center gap-4" style={{ animationDelay: "0ms" }}>
              <p className="landing-eyebrow font-mono text-xs font-semibold uppercase tracking-[0.2em] text-accent sm:text-sm">
                {t.eyebrow}
              </p>
            </div>
            <h1 id="landing-title"
              className="landing-rise landing-title mt-3 text-5xl font-semibold tracking-tight sm:text-7xl"
              style={{ animationDelay: "120ms" }}>
              AstroHealth
            </h1>
            <p className="landing-rise landing-lead mt-5 max-w-xl text-base text-muted sm:text-lg" style={{ animationDelay: "260ms" }}>
              {t.lead}
            </p>
            <ul className="landing-rise landing-pillars mt-7 grid gap-3 sm:grid-cols-3" style={{ animationDelay: "380ms" }}>
              {t.pillars.map((p, i) => (
                <li key={i} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur">
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
                    {String(i + 1).padStart(2, "0")} · {p.title}
                  </span>
                  <span className="mt-1 block text-sm leading-snug text-muted">{p.text}</span>
                </li>
              ))}
            </ul>
            <div className="landing-rise landing-cta-wrap mt-9" style={{ animationDelay: "520ms" }}>
              <Link to={APP_ENTRY} onClick={goToApp} aria-disabled={leaving}
                className="landing-cta group inline-flex min-h-14 items-center gap-3 rounded-2xl bg-accent-strong px-7 text-lg font-semibold text-white transition-[background-color,box-shadow] hover:bg-[#1d4ed8]">
                {t.cta}
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
          {t.credits.textures}:{" "}
          <a href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
            Solar System Scope
          </a>{" "}
          (CC BY 4.0) · {t.credits.iss}
        </p>
      )}

      {/* переход: экран «стыковки с бортовым компьютером» поверх нырка камеры */}
      {leaving && (
        <div role="status" aria-live="assertive" className="landing-boot absolute inset-0 z-30 flex flex-col items-center justify-center px-6">
          <div className="landing-boot-emblem relative">
            <span aria-hidden className="landing-boot-ring absolute -inset-4 rounded-full border border-accent/40" />
            <img src={LOGO} alt="" aria-hidden width={128} height={128} className="h-28 w-28 rounded-full sm:h-32 sm:w-32" />
          </div>
          <ul className="mt-8 space-y-2 text-center font-mono text-xs uppercase tracking-[0.18em] text-muted sm:text-sm">
            {t.boot.map((l, i) => (
              <li key={i} className="landing-boot-line" style={{ animationDelay: `${1050 + i * 280}ms` }}>
                <span className={i === t.boot.length - 1 ? "text-ok" : ""}>{l}</span>
                {i < t.boot.length - 1 ? "…" : " ✓"}
              </li>
            ))}
          </ul>
          <div aria-hidden className="mt-6 h-1 w-56 overflow-hidden rounded-full bg-white/10">
            <div className="landing-boot-bar h-full rounded-full bg-accent" />
          </div>
        </div>
      )}
    </div>
  );
}
