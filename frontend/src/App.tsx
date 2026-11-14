import {
  Bell, ChevronRight, Globe, HeartPulse, Menu, OctagonAlert, Rocket, SlidersHorizontal, Users, X,
  type LucideIcon,
} from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { DirectorPanel } from "./components/DirectorPanel";
import { Drawer } from "./components/Drawer";
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
import { GroundPage } from "./pages/GroundPage";
import { MePage } from "./pages/MePage";

// Лендинг с three.js — отдельным чанком, чтобы не утяжелять экраны приложения
const LandingPage = lazy(() => import("./pages/LandingPage").then((m) => ({ default: m.LandingPage })));

/*
 * Навигация: две категории и четыре экрана.
 * Убраны дубли: «Корабль» (модули — внутри «Экипаж и корабль»), «Демо» (склейка других экранов),
 * «Пульт» (теперь выдвижная панель, доступная с любого экрана), карточка астронавта (= «Моё здоровье»).
 */
type NavItem = { to: string; label: string; icon: LucideIcon; match: string[] };
const NAV_GROUPS: { id: string; title: string; icon: LucideIcon; items: NavItem[] }[] = [
  {
    id: "board", title: "Борт", icon: Rocket, items: [
      { to: "/me/a3", label: "Моё здоровье", icon: HeartPulse, match: ["/me"] },
      { to: "/alerts", label: "Тревоги", icon: Bell, match: ["/alerts"] },
      { to: "/crew", label: "Экипаж и корабль", icon: Users, match: ["/crew"] },
    ],
  },
  {
    id: "earth", title: "Земля", icon: Globe, items: [
      { to: "/ground", label: "Центр управления", icon: Globe, match: ["/ground"] },
    ],
  },
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
  const { pathname } = useLocation();
  const openAlerts = onboard?.alerts.filter((a) => a.status !== "resolved").length ?? 0;
  return (
    <>
      {NAV_GROUPS.map((g) => (
        <div key={g.id} className="mb-5">
          <div className="nav-group-title mb-2 flex items-center gap-2 px-3">
            <g.icon aria-hidden className="h-3.5 w-3.5 text-accent" />
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-subtle">{g.title}</span>
            <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
          </div>
          <ul className="space-y-1">
            {g.items.map(({ to, label, icon: Icon, match }) => {
              const active = match.some((m) => pathname.startsWith(m));
              return (
                <li key={to}>
                  <NavLink to={to} onClick={onNavigate} aria-current={active ? "page" : undefined}
                    className={`nav-item group relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] ${active ? "nav-item-active font-medium text-fg" : "text-muted hover:text-fg"}`}>
                    <Icon aria-hidden className={`h-5 w-5 shrink-0 transition-transform duration-200 group-hover:scale-110 ${active ? "text-accent" : ""}`} />
                    <span>{label}</span>
                    {to === "/alerts" && openAlerts > 0 && (
                      <span className="num ml-auto rounded-full bg-crit/20 px-2 py-0.5 text-xs font-semibold text-crit"
                        aria-label={`${openAlerts} активных тревог`}>{openAlerts}</span>
                    )}
                  </NavLink>
                </li>
              );
            })}
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
      className={`card mb-6 flex items-start gap-4 rounded-2xl border p-5 ${boot.error ? "border-crit/70 bg-crit/10" : "border-white/[0.07]"}`}>
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

/** Карточка миссии внизу меню: время, скорость, связь — единственное место, где они показаны. */
function MissionCard({ onOpenDirector }: { onOpenDirector: () => void }) {
  const { onboard, connected } = useSnapshot();
  return (
    <div className="space-y-3">
      {!connected && !BROWSER_RUNTIME && (
        <p role="status" className="rounded-lg border border-crit/70 bg-crit/10 px-3 py-2 text-sm text-crit">Нет соединения с бэкендом</p>
      )}
      {!connected && BROWSER_RUNTIME && (
        <p role="status" className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-muted">Запуск симуляции…</p>
      )}
      {onboard && (
        <div className="mission-card rounded-2xl border border-white/[0.07] p-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-xs text-subtle">
              <span aria-hidden className="live-dot" />{onboard.mission}
            </span>
            <span className="num rounded-md bg-white/[0.06] px-1.5 py-0.5 text-xs text-muted" title="Скорость времени">×{onboard.speed}</span>
          </div>
          <p className="num mt-1 text-2xl font-semibold tracking-tight">{fmtClock(onboard.time)}</p>
          <div className="mt-2"><LinkBadge link={onboard.link} compact /></div>
        </div>
      )}
      <button type="button" onClick={onOpenDirector}
        className="group flex min-h-11 w-full items-center gap-3 rounded-xl border border-dashed border-white/15 px-3 text-sm text-muted transition-colors hover:border-accent/60 hover:text-fg">
        <SlidersHorizontal aria-hidden className="h-4 w-4 text-accent transition-transform duration-300 group-hover:rotate-90" />
        Пульт сценариев
        <span className="ml-auto rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-subtle">демо</span>
      </button>
    </div>
  );
}

function Brand() {
  return (
    <Link to="/" className="group flex min-h-11 items-center gap-2.5 rounded-xl px-1" title="На приветственный экран">
      <img src={`${import.meta.env.BASE_URL}brand/astrohealth-logo-128.png`} alt="" aria-hidden width={36} height={36}
        className="h-9 w-9 rounded-full shadow-[0_0_16px_-4px_rgb(96_165_250/0.7)] transition-transform duration-500 group-hover:rotate-[20deg]" />
      <span className="text-lg font-semibold tracking-tight">AstroHealth</span>
    </Link>
  );
}

/** Старый адрес карточки астронавта ведёт на единый экран «Моё здоровье». */
function CrewMemberRedirect() {
  const { id = "a3" } = useParams();
  return <Navigate to={`/me/${id}`} replace />;
}

export function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const main = useRef<HTMLElement>(null);
  const first = useRef(true);
  const [menuOpen, setMenuOpen] = useState(false);
  // пульт открывается кнопкой в меню или ссылкой ?pult (старый /director тоже ведёт сюда)
  const directorOpen = new URLSearchParams(location.search).has("pult");
  const openDirector = useCallback(() => {
    const p = new URLSearchParams(location.search);
    p.set("pult", "");
    navigate({ pathname: location.pathname, search: p.toString() }, { state: location.state });
    setMenuOpen(false);
  }, [location, navigate]);
  const closeDirector = useCallback(() => {
    const p = new URLSearchParams(location.search);
    p.delete("pult");
    navigate({ pathname: location.pathname, search: p.toString() }, { replace: true, state: location.state });
  }, [location, navigate]);

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
    // после перехода с лендинга приложение плавно «включается»
    <div className={`app-bg min-h-dvh ${(location.state as { fromLanding?: boolean } | null)?.fromLanding ? "app-boot" : ""}`}>
      <div aria-hidden className="app-stars" />
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-accent-strong focus:px-4 focus:py-3 focus:text-white">
        Перейти к содержимому
      </a>

      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-white/[0.06] bg-[#0a0e15]/80 p-4 backdrop-blur-xl lg:flex">
        <Brand />
        <nav aria-label="Основная навигация" className="mt-7 flex-1 overflow-y-auto"><NavItems /></nav>
        <MissionCard onOpenDirector={openDirector} />
      </aside>

      <header className="sticky top-0 z-20 flex min-h-14 items-center gap-3 border-b border-white/[0.06] bg-[#0a0e15]/85 px-4 backdrop-blur-xl lg:hidden">
        <Brand />
        <button type="button" onClick={() => setMenuOpen((v) => !v)} aria-expanded={menuOpen} aria-controls="mobile-nav"
          aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
          className="ml-auto inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 text-fg">
          {menuOpen ? <X aria-hidden className="h-5 w-5" /> : <Menu aria-hidden className="h-5 w-5" />}
        </button>
      </header>
      {menuOpen && (
        <nav id="mobile-nav" aria-label="Основная навигация" className="enter sticky top-14 z-20 border-b border-white/[0.06] bg-[#0a0e15]/95 p-4 backdrop-blur-xl lg:hidden">
          <NavItems onNavigate={() => setMenuOpen(false)} />
          <MissionCard onOpenDirector={openDirector} />
        </nav>
      )}

      <div className="relative lg:pl-64">
        <div className="sticky top-14 z-10 lg:top-0"><CriticalBanner /></div>
        <main id="main" ref={main} tabIndex={-1} className="mx-auto max-w-[1400px] px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8">
          <BootNotice />
          {/* смена экрана — мягкое появление (ключ по адресу перезапускает анимацию) */}
          <div key={location.pathname} className="route-enter">
            <Suspense fallback={<PageSkeleton />}>
              <Routes>
                <Route path="/me/:id" element={<MePage />} />
                <Route path="/me/:id/checkin" element={<CheckinPage />} />
                <Route path="/alerts" element={<AlertsPage />} />
                <Route path="/alerts/:id" element={<AlertPage />} />
                <Route path="/crew" element={<CrewPage />} />
                {/* старые адреса — на новые места, ссылки не ломаются */}
                <Route path="/crew/:id" element={<CrewMemberRedirect />} />
                <Route path="/environment" element={<Navigate to="/crew#modules" replace />} />
                <Route path="/ground" element={<GroundPage />} />
                <Route path="/demo" element={<Navigate to="/me/a3?pult" replace />} />
                <Route path="/director" element={<Navigate to="/me/a3?pult" replace />} />
                <Route path="*" element={<Navigate to="/me/a3" replace />} />
              </Routes>
            </Suspense>
          </div>
        </main>
      </div>

      <Drawer open={directorOpen} onClose={closeDirector} eyebrow="Только для демо" title="Пульт сценариев">
        <DirectorPanel />
      </Drawer>
    </div>
  );
}
