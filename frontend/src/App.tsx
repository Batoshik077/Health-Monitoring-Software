import {
  Bell, Building2, ChevronRight, Columns2, Globe, HeartPulse, Menu, OctagonAlert, Satellite, SlidersHorizontal, Users, X,
  type LucideIcon,
} from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { LinkBadge } from "./components/LinkBadge";
import { PageSkeleton } from "./components/ui";
import { BROWSER_RUNTIME } from "./lib/runtime";
import { fmtClock } from "./lib/format";
import { useSnapshot } from "./lib/snapshot";
import { beep } from "./lib/sound";
import { AlertPage } from "./pages/AlertPage";
import { AlertsPage } from "./pages/AlertsPage";
import { CheckinPage } from "./pages/CheckinPage";
import { CrewPage } from "./pages/CrewPage";
import { EnvironmentPage } from "./pages/EnvironmentPage";
import { GroundPage } from "./pages/GroundPage";
import { MePage } from "./pages/MePage";

// Графики (recharts) грузятся только на экранах, где они нужны
const AstronautPage = lazy(() => import("./pages/AstronautPage").then((m) => ({ default: m.AstronautPage })));
const DemoPage = lazy(() => import("./pages/DemoPage").then((m) => ({ default: m.DemoPage })));
const DirectorPage = lazy(() => import("./pages/DirectorPage").then((m) => ({ default: m.DirectorPage })));
// Лендинг с three.js — отдельным чанком, чтобы не утяжелять экраны приложения
const LandingPage = lazy(() => import("./pages/LandingPage").then((m) => ({ default: m.LandingPage })));

const NAV: { to: string; label: string; icon: LucideIcon; group: "crew" | "ops" }[] = [
  { to: "/me/a3", label: "Моё здоровье", icon: HeartPulse, group: "crew" },
  { to: "/alerts", label: "Тревоги", icon: Bell, group: "crew" },
  { to: "/crew", label: "Экипаж", icon: Users, group: "crew" },
  { to: "/environment", label: "Корабль", icon: Building2, group: "crew" },
  { to: "/ground", label: "Земля", icon: Globe, group: "ops" },
  { to: "/demo", label: "Демо", icon: Columns2, group: "ops" },
  { to: "/director", label: "Пульт", icon: SlidersHorizontal, group: "ops" },
];

function CriticalBanner() {
  const { onboard } = useSnapshot();
  const seen = useRef<Set<string>>(new Set());
  const critical = onboard?.alerts.filter((a) => a.severity === "critical" && a.status === "active") ?? [];
  const ids = critical.map((a) => a.id).join(",");
  useEffect(() => {
    const fresh = critical.filter((a) => !seen.current.has(a.id));
    if (fresh.length) beep();
    fresh.forEach((a) => seen.current.add(a.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);
  const a = critical[0];
  return (
    <div role="alert" aria-live="assertive">
      {a && (
        <Link to={`/alerts/${a.id}`}
          className="pulse-critical flex min-h-12 items-center justify-center gap-3 bg-crit-strong px-4 py-2 text-center font-semibold text-white">
          <OctagonAlert aria-hidden className="h-5 w-5 shrink-0" />
          <span>Критично · {a.subject_name}: {a.message}{critical.length > 1 && ` (ещё ${critical.length - 1})`}</span>
          <span className="inline-flex items-center gap-1 rounded-lg bg-black/30 px-2 py-1 text-sm">
            Открыть протокол <ChevronRight aria-hidden className="h-4 w-4" />
          </span>
        </Link>
      )}
    </div>
  );
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const { onboard } = useSnapshot();
  const openAlerts = onboard?.alerts.filter((a) => a.status !== "resolved").length ?? 0;
  const groups = [["crew", "Борт"], ["ops", "Земля и демо"]] as const;
  return (
    <>
      {groups.map(([g, title]) => (
        <div key={g} className="mb-4">
          <div className="mb-1 px-3 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">{title}</div>
          <ul className="space-y-1">
            {NAV.filter((n) => n.group === g).map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink to={to} onClick={onNavigate}
                  className={({ isActive }) => `relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] transition-colors ${isActive
                    ? "bg-surface-2 font-medium text-fg before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-full before:bg-accent"
                    : "text-muted hover:bg-surface-2/60 hover:text-fg"}`}>
                  <Icon aria-hidden className="h-5 w-5 shrink-0" />
                  <span>{label}</span>
                  {to === "/alerts" && openAlerts > 0 && (
                    <span className="num ml-auto rounded-full bg-crit/15 px-2 py-0.5 text-xs font-semibold text-crit"
                      aria-label={`${openAlerts} активных тревог`}>{openAlerts}</span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

/** Браузерный режим (Vercel): Pyodide загружается несколько секунд — показываем, что происходит. */
function BootNotice() {
  const { boot, connected } = useSnapshot();
  if (!BROWSER_RUNTIME || connected || !boot) return null;
  return (
    <div role="status" aria-live="polite"
      className={`mb-6 flex items-start gap-4 rounded-2xl border p-5 ${boot.error ? "border-crit/70 bg-crit/10" : "border-line bg-surface/90"}`}>
      {!boot.error && <span aria-hidden className="mt-1 h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-line border-t-accent" />}
      <div>
        <p className={`font-medium ${boot.error ? "text-crit" : "text-fg"}`}>{boot.error ?? boot.stage}</p>
        <p className="mt-1 text-sm text-muted">
          {boot.error
            ? "Обновите страницу. Нужен современный браузер с поддержкой WebAssembly."
            : "Бортовая система работает прямо в вашем браузере: Python-код бэкенда запущен через WebAssembly. Первый запуск — 5–15 секунд."}
        </p>
      </div>
    </div>
  );
}

function MissionClock() {
  const { onboard, connected } = useSnapshot();
  return (
    <div className="space-y-2 text-sm">
      {!connected && !BROWSER_RUNTIME && (
        <p role="status" className="rounded-lg border border-crit/70 bg-crit/10 px-3 py-2 text-crit">Нет соединения с бэкендом</p>
      )}
      {!connected && BROWSER_RUNTIME && (
        <p role="status" className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-muted">Запуск симуляции…</p>
      )}
      {onboard && (
        <>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-subtle">{onboard.mission}</span>
            <span className="num text-fg">{fmtClock(onboard.time)}</span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-subtle">Скорость времени</span>
            <span className="num text-fg">×{onboard.speed}</span>
          </div>
          <LinkBadge link={onboard.link} compact />
        </>
      )}
    </div>
  );
}

function Brand() {
  return (
    <Link to="/" className="flex min-h-11 items-center gap-2.5 rounded-xl px-1">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-strong/20 text-accent">
        <Satellite aria-hidden className="h-5 w-5" />
      </span>
      <span className="text-lg font-semibold tracking-tight">AstroHealth</span>
    </Link>
  );
}

export function App() {
  const location = useLocation();
  const main = useRef<HTMLElement>(null);
  const first = useRef(true);
  const [menuOpen, setMenuOpen] = useState(false);

  // Фокус на основное содержимое после перехода (для экранных дикторов)
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    main.current?.focus({ preventScroll: false });
  }, [location.pathname]);

  // Приветственный лендинг — на весь экран, без меню приложения
  if (location.pathname === "/") {
    return (
      <Suspense fallback={<div className="h-dvh bg-[#05070b]" />}>
        <LandingPage />
      </Suspense>
    );
  }

  return (
    <div className="min-h-dvh hud-grid">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-accent-strong focus:px-4 focus:py-3 focus:text-white">
        Перейти к содержимому
      </a>

      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-line bg-surface/95 p-4 lg:flex">
        <Brand />
        <nav aria-label="Основная навигация" className="mt-6 flex-1 overflow-y-auto"><NavItems /></nav>
        <MissionClock />
      </aside>

      <header className="sticky top-0 z-20 flex min-h-14 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur lg:hidden">
        <Brand />
        <button type="button" onClick={() => setMenuOpen((v) => !v)} aria-expanded={menuOpen} aria-controls="mobile-nav"
          aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
          className="ml-auto inline-flex h-11 w-11 items-center justify-center rounded-xl border border-control/60 text-fg">
          {menuOpen ? <X aria-hidden className="h-5 w-5" /> : <Menu aria-hidden className="h-5 w-5" />}
        </button>
      </header>
      {menuOpen && (
        <nav id="mobile-nav" aria-label="Основная навигация" className="enter sticky top-14 z-20 border-b border-line bg-surface p-4 lg:hidden">
          <NavItems onNavigate={() => setMenuOpen(false)} />
          <MissionClock />
        </nav>
      )}

      <div className="lg:pl-64">
        <div className="sticky top-14 z-10 lg:top-0"><CriticalBanner /></div>
        <main id="main" ref={main} tabIndex={-1} className="mx-auto max-w-[1400px] px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8">
          <BootNotice />
          <Suspense fallback={<PageSkeleton />}>
            <Routes>
              <Route path="/" element={<Navigate to="/me/a3" replace />} />
              <Route path="/me/:id" element={<MePage />} />
              <Route path="/me/:id/checkin" element={<CheckinPage />} />
              <Route path="/alerts" element={<AlertsPage />} />
              <Route path="/alerts/:id" element={<AlertPage />} />
              <Route path="/crew" element={<CrewPage />} />
              <Route path="/crew/:id" element={<AstronautPage />} />
              <Route path="/environment" element={<EnvironmentPage />} />
              <Route path="/ground" element={<GroundPage />} />
              <Route path="/demo" element={<DemoPage />} />
              <Route path="/director" element={<DirectorPage />} />
              <Route path="*" element={<Navigate to="/me/a3" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  );
}
