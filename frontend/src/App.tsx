import { useEffect, useRef } from "react";
import { Link, NavLink, Navigate, Route, Routes } from "react-router-dom";
import { LinkBadge } from "./components/LinkBadge";
import { fmtClock } from "./lib/format";
import { useSnapshot } from "./lib/snapshot";
import { beep } from "./lib/sound";
import { AlertPage } from "./pages/AlertPage";
import { AlertsPage } from "./pages/AlertsPage";
import { AstronautPage } from "./pages/AstronautPage";
import { CheckinPage } from "./pages/CheckinPage";
import { CrewPage } from "./pages/CrewPage";
import { DemoPage } from "./pages/DemoPage";
import { DirectorPage } from "./pages/DirectorPage";
import { EnvironmentPage } from "./pages/EnvironmentPage";
import { GroundPage } from "./pages/GroundPage";
import { MePage } from "./pages/MePage";

const NAV = [
  ["/me/a3", "Моё здоровье"],
  ["/alerts", "Тревоги"],
  ["/crew", "Экипаж"],
  ["/environment", "Корабль"],
  ["/ground", "Земля"],
  ["/demo", "Демо"],
  ["/director", "Пульт"],
] as const;

function CriticalBanner() {
  const { onboard } = useSnapshot();
  const seen = useRef<Set<string>>(new Set());
  const critical = onboard?.alerts.filter((a) => a.severity === "critical" && a.status === "active") ?? [];
  useEffect(() => {
    const fresh = critical.filter((a) => !seen.current.has(a.id));
    if (fresh.length) beep();
    fresh.forEach((a) => seen.current.add(a.id));
  }, [critical]);
  if (!critical.length) return null;
  const a = critical[0];
  return (
    <Link to={`/alerts/${a.id}`} className="pulse-critical block bg-rose-700 px-4 py-2 text-center text-sm font-semibold text-white">
      ⚠ КРИТИЧНО · {a.subject_name}: {a.message} — открыть протокол
      {critical.length > 1 && ` (+${critical.length - 1})`}
    </Link>
  );
}

export function App() {
  const { onboard, connected } = useSnapshot();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <CriticalBanner />
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <Link to="/" className="font-bold">🛰 AstroHealth</Link>
          <nav className="flex flex-wrap gap-1 text-sm">
            {NAV.map(([to, label]) => (
              <NavLink key={to} to={to}
                className={({ isActive }) => `rounded-md px-2 py-1 ${isActive ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"}`}>
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-xs text-slate-400">
            {!connected && <span className="text-rose-400">нет соединения с бэкендом</span>}
            {onboard && (
              <>
                <span className="tabular-nums">{onboard.mission} · {fmtClock(onboard.time)} · ×{onboard.speed}</span>
                <LinkBadge link={onboard.link} />
              </>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4">
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
        </Routes>
      </main>
    </div>
  );
}
