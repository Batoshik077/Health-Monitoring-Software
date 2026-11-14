"""Mission — состояние миссии: связывает SimClock, Simulator, Analytics, Alerts, Guidance и Link.

Борт (onboard) видит всё сразу. Земля (ground) — только то, что прошло через канал связи.
"""
from __future__ import annotations

import itertools
import math
import random
from collections import deque

from app.alerts.engine import AlertEngine
from app.alerts.rules import build_rules
from app.analytics import news2
from app.analytics.baseline import Baseline
from app.analytics.readiness import body_systems, readiness
from app.clock import DAY, SimClock
from app.db import Store
from app.guidance.protocols import Guidance, daily_advice
from app.link.channel import Link
from app.settings import Config
from app.simulator.environment import PROFILE_DOSE_KEY, EnvironmentGenerator
from app.simulator.scenarios import ScenarioEngine
from app.simulator.vitals import VitalsGenerator, round_vitals

VITAL_KEYS = ("hr", "spo2", "rr", "sbp", "temp")
PLAUSIBLE = {"hr": (25, 220), "spo2": (50, 100), "rr": (4, 60), "sbp": (50, 250), "temp": (30, 43)}
MAX_STEP_S = 30.0          # крупные шаги дробим, чтобы таймеры удержания тревог были точными
HISTORY_EVERY_S = 2.0
P1_EVERY_S = 60.0          # поминутные сводки на Землю
P2_EVERY_S = 10.0          # подробные данные на Землю


def _clamp(x, lo, hi):
    return max(lo, min(hi, x))


class AstronautState:
    def __init__(self, spec: dict, start_day: int, rng: random.Random, today: int):
        self.id = spec["id"]
        self.name = spec["name"]
        self.role = spec["role"]
        self.module = spec["module"]
        self.note = spec.get("note")
        self.spec = spec
        self.gen = VitalsGenerator(spec, rng)
        self.baseline = Baseline(spec["baseline"])
        self.start_day = start_day
        self.today = today
        self.now = 0.0
        self.vitals: dict = {}
        self.quality_ok = True
        self.bad_metrics: list[str] = []
        self.news2_total = 0
        self.news2_parts = {k: 0 for k in VITAL_KEYS}
        self.news2_level = "normal"
        self.z: dict = {}
        self.at_rest = True
        self.readiness = 100
        self.dose_msv = float(spec.get("dose_msv_start", 0))
        self.dose_rate_spike = False
        self.history: deque = deque(maxlen=3000)
        self._last_hist = -math.inf
        sleep_h = spec["baseline"].get("sleep_h", 6.5)
        self.sleep = [round(sleep_h + rng.gauss(0, 0.3), 1) for _ in range(5)]
        self.surveys = [
            {"day": today - i, "mood": 7, "stress": 3, "fatigue": 3, "sleep_quality": 7, "source": "mock"}
            for i in (2, 1)
        ]
        self.symptoms: list[dict] = []
        self.exercise_days = {today - i: int(115 + rng.gauss(0, 8)) for i in range(1, 8)}
        self.exercise_days[today] = 0

    # --- вспомогательные методы для правил и экранов
    def exercise_7d(self) -> int:
        """Сумма за 7 последних полных дней (сегодняшний ещё не закончился)."""
        return sum(self.exercise_days.get(self.today - i, 0) for i in range(1, 8))

    @property
    def exercise_today(self) -> int:
        return self.exercise_days.get(self.today, 0)

    def last_survey(self) -> dict | None:
        return self.surveys[-1] if self.surveys else None

    @property
    def checked_in_today(self) -> bool:
        return any(s["day"] == self.today and s["source"] == "astronaut" for s in self.surveys)

    def recent_symptoms(self) -> list[dict]:
        return [s for s in self.symptoms if s["t"] >= self.now - 3 * DAY]

    @property
    def mission_day(self) -> int:
        return self.start_day + self.today + 1

    def bone_loss_pct(self) -> float:
        # ~1 % минеральной плотности в месяц (NASA: 1–1.5 %); это грубая оценка, не измерение
        return self.mission_day / 30 * 1.0


class ModuleState:
    def __init__(self, spec: dict, base_dose_rate: float, rng: random.Random):
        self.id = spec["id"]
        self.name = spec["name"]
        self.gen = EnvironmentGenerator(spec, base_dose_rate, rng)
        self.base_dose_rate = base_dose_rate
        self.nominal_pressure = spec["pressure_kpa"]
        self.env: dict = {}
        self._co2: deque = deque()       # (t, value, dt)
        self._pressure: deque = deque()  # (t, value)

    def update(self, env: dict, t: float, dt: float) -> None:
        self.env = env
        self._co2.append((t, env["co2_mmhg"], dt))
        while self._co2 and self._co2[0][0] < t - 3600:
            self._co2.popleft()
        self._pressure.append((t, env["pressure_kpa"]))
        while self._pressure and self._pressure[0][0] < t - 120:
            self._pressure.popleft()

    def co2_avg_1h(self) -> float:
        w = sum(d for _, _, d in self._co2)
        return sum(v * d for _, v, d in self._co2) / w if w else self.env.get("co2_mmhg", 0)

    def pressure_rate_per_min(self) -> float:
        if len(self._pressure) < 2:
            return 0.0
        (t0, p0), (t1, p1) = self._pressure[0], self._pressure[-1]
        return (p1 - p0) / ((t1 - t0) / 60) if t1 - t0 >= 30 else 0.0


class GroundState:
    """То, что знает Земля: только «долетевшие» пакеты."""

    def __init__(self):
        self.crew: dict[str, dict] = {}
        self.modules: dict[str, dict] = {}
        self.alerts: dict[str, dict] = {}
        self.runs: dict[str, dict] = {}

    def apply(self, payloads: list[dict]) -> None:
        for p in payloads:
            kind = p["kind"]
            if kind in ("summary", "raw"):
                rec = self.crew.setdefault(p["astronaut"], {"id": p["astronaut"], "sample_t": -1})
                if p["sample_t"] >= rec.get("sample_t", -1):
                    rec.update({k: v for k, v in p.items() if k not in ("kind",)})
            elif kind == "env":
                rec = self.modules.get(p["module"])
                if rec is None or p["sample_t"] >= rec["sample_t"]:
                    self.modules[p["module"]] = p
            elif kind == "alert":
                a = p["alert"]
                old = self.alerts.get(a["id"])
                if old is None or a["updated_at"] >= old["updated_at"]:
                    a["received_at"] = p["_received_at"]
                    a["first_received_at"] = old["first_received_at"] if old else p["_received_at"]
                    self.alerts[a["id"]] = a
            elif kind == "protocol_run":
                self.runs[p["run"]["id"]] = p["run"]


class Mission:
    def __init__(self, cfg: Config, store: Store | None = None, seed: int = 42, speed: float = 1.0):
        self.cfg = cfg
        self.th = cfg.thresholds
        self.clock = SimClock(speed)
        self.rng = random.Random(seed)
        m = cfg.crew["mission"]
        self.mission_name = m.get("name", "Mission")
        dose_key = PROFILE_DOSE_KEY.get(m.get("link_profile", "mars"), "mars_transit")
        base_rate = self.th["radiation"]["daily_rate_msv"][dose_key]
        self.modules = {s["id"]: ModuleState(s, base_rate, self.rng) for s in cfg.crew["modules"]}
        today = SimClock.day_index(0)
        self.astronauts = {
            s["id"]: AstronautState(s, m.get("start_day", 0), self.rng, today) for s in cfg.crew["astronauts"]
        }
        self.scenarios = ScenarioEngine(cfg.scenarios)
        self.alerts = AlertEngine(build_rules(self.th), cfg.rule_to_protocol)
        self.guidance = Guidance(cfg.protocols)
        self.link = Link(m.get("link_profile", "mars"), m.get("link_delay_s"), m.get("link_bandwidth_pps", 2))
        self.ground = GroundState()
        self.store = store or Store()
        self.onboard_messages: list[dict] = []
        self.ground_messages: list[dict] = []
        self._msg_ids = itertools.count(1)
        self._last_p1 = -math.inf
        self._last_p2 = -math.inf
        self.step(1.0)

    # ------------------------------------------------------------------ время
    def advance(self, real_dt: float) -> None:
        remaining = real_dt * self.clock.speed
        while remaining > 1e-9:
            d = min(remaining, MAX_STEP_S)
            self.step(d)
            remaining -= d

    def step(self, dt: float) -> None:
        t_prev = self.clock.t
        self.clock.t += dt
        t = self.clock.t
        self.scenarios.tick(t)

        for mod in self.modules.values():
            env = self.scenarios.apply_env(mod.id, mod.gen.sample(dt), t)
            mod.update(env, t, dt)

        if SimClock.day_index(t) > SimClock.day_index(t_prev):
            self._new_day(SimClock.day_index(t), t)

        for a in self.astronauts.values():
            self._update_astronaut(a, t_prev, t, dt)

        self.alerts.evaluate(
            {"astronaut": list(self.astronauts.values()), "module": list(self.modules.values())}, self.th, t)
        self._drain_alert_events(t)
        self._rechecks(t)
        self._drain_alert_events(t)
        self._telemetry(t, dt)

    def _update_astronaut(self, a: AstronautState, t_prev: float, t: float, dt: float) -> None:
        a.now = t
        mod = self.modules[a.module]
        v = self.scenarios.apply_vitals(a.id, a.module, a.gen.sample(t, dt), t)
        for metric in self.scenarios.sensor_garbage(a.id):
            v[metric] = self.rng.choice([None, 0, 3, 127])
        v = round_vitals(v)
        a.bad_metrics = [k for k in VITAL_KEYS
                         if v[k] is None or not (PLAUSIBLE[k][0] <= v[k] <= PLAUSIBLE[k][1])]
        a.quality_ok = not a.bad_metrics
        calc = {k: (None if k in a.bad_metrics else v[k]) for k in VITAL_KEYS}
        a.vitals = v
        a.at_rest = (v.get("activity") or 0) < 0.2
        a.news2_total, a.news2_parts = news2.score(calc, self.th["vitals"])
        a.news2_level = news2.level(a.news2_total, a.news2_parts, self.th["news2_levels"])
        a.z = {k: (round(z, 2) if (z := a.baseline.z(k, calc[k])) is not None else None) for k in VITAL_KEYS}
        if a.quality_ok:
            a.baseline.update(calc, dt, a.at_rest)
        a.dose_msv += mod.env["dose_rate_msv_day"] * dt / DAY
        a.dose_rate_spike = mod.env["dose_rate_msv_day"] > mod.base_dose_rate * self.th["radiation"]["spike_multiplier"]
        sessions = a.gen.finished_sessions(t_prev, t)
        if sessions:
            a.exercise_days[a.today] = a.exercise_days.get(a.today, 0) + 60 * sessions
            self.store.append("exercise_log", a.id, t, {"minutes": 60 * sessions, "type": "mixed", "source": "sensor"})
        a.readiness = readiness(a.news2_total, a.sleep, a.last_survey(), a.z.get("hr"), a.at_rest)
        if t - a._last_hist >= HISTORY_EVERY_S:
            a._last_hist = t
            a.history.append({"t": round(t, 1), **{k: v[k] for k in VITAL_KEYS},
                              "news2": a.news2_total, "readiness": a.readiness})

    def _new_day(self, day: int, t: float) -> None:
        for a in self.astronauts.values():
            a.today = day
            a.exercise_days.setdefault(day, 0)
            for old in [d for d in a.exercise_days if d < day - 14]:
                del a.exercise_days[old]
            override = self.scenarios.override(a.id, "sleep_h")
            sleep = override if override is not None else a.spec["baseline"].get("sleep_h", 6.5) + self.rng.gauss(0, 0.4)
            a.sleep = (a.sleep + [round(sleep, 1)])[-14:]
            self.surveys_mock(a, day)

    def surveys_mock(self, a: AstronautState, day: int) -> None:
        """Мок-ответы на утренний опросник за астронавтов, которые не проходят его сами."""
        fatigue = self.scenarios.override(a.id, "survey_fatigue")
        r = self.rng
        s = {"day": day, "mood": _clamp(round(r.gauss(7, 1)), 0, 10), "stress": _clamp(round(r.gauss(3, 1)), 0, 10),
             "fatigue": fatigue if fatigue is not None else _clamp(round(r.gauss(3, 1)), 0, 10),
             "sleep_quality": _clamp(round(r.gauss(7, 1)), 0, 10), "source": "mock"}
        a.surveys = (a.surveys + [s])[-30:]

    # ------------------------------------------------------------------ тревоги и протоколы
    def _drain_alert_events(self, t: float) -> None:
        events, self.alerts.events = self.alerts.events, []
        for kind, alert in events:
            if kind == "created" and alert.protocol_id:
                run = self.guidance.start(alert, t)
                if run:
                    self._send_run(run, t)
            self.store.upsert("alerts", alert.id, t, alert.to_dict())
            self.link.send(0, {"kind": "alert", "alert": alert.to_dict(), "sample_t": t}, t)

    def _send_run(self, run, t: float) -> None:
        self.store.upsert("protocol_runs", run.id, t, run.to_dict())
        self.link.send(0, {"kind": "protocol_run", "run": run.to_dict(), "sample_t": t}, t)

    def _rechecks(self, t: float) -> None:
        for run in self.guidance.due_rechecks(t):
            alert = self.alerts.alerts[run.alert_id]
            run.finished_at = t
            if not self.alerts.group_firing(alert.group, alert.subject_id):
                run.status = "improved"
                self.alerts.resolve(alert.id, t, "Протокол выполнен, показатель вернулся в норму")
            else:
                run.status = "not_improved"
                self.alerts.escalate(alert, run.escalate_if_not, t, "после протокола лучше не стало")
            self._send_run(run, t)

    def _subject_astronaut(self, alert) -> AstronautState | None:
        return self.astronauts.get(alert.subject_id) if alert.subject_type == "astronaut" else None

    def astronaut_status(self, a: AstronautState) -> str:
        sev = [al.severity for al in self.alerts.alerts.values() if al.open and (
            (al.subject_type == "astronaut" and al.subject_id == a.id) or
            (al.subject_type == "module" and al.subject_id == a.module))]
        if "critical" in sev or a.news2_level == "critical":
            return "red"
        if "warning" in sev or a.news2_level == "warning":
            return "yellow"
        return "green"

    # ------------------------------------------------------------------ связь
    def _telemetry(self, t: float, dt: float) -> None:
        if t - self._last_p1 >= P1_EVERY_S:
            self._last_p1 = t
            for a in self.astronauts.values():
                self.link.send(1, {"kind": "summary", "astronaut": a.id, "name": a.name, "role": a.role,
                                   "module": a.module, "sample_t": t, "vitals": a.vitals, "news2": a.news2_total,
                                   "readiness": a.readiness, "status": self.astronaut_status(a),
                                   "dose_msv": round(a.dose_msv, 1)}, t)
            for mod in self.modules.values():
                self.link.send(1, {"kind": "env", "module": mod.id, "name": mod.name, "sample_t": t,
                                   "env": self._env_dict(mod)}, t)
        if t - self._last_p2 >= P2_EVERY_S:
            self._last_p2 = t
            for a in self.astronauts.values():
                self.link.send(2, {"kind": "raw", "astronaut": a.id, "sample_t": t, "vitals": a.vitals}, t)
        self.link.set_forced_down(self.scenarios.link_down(), t)
        down, up = self.link.step(t, dt)
        self.ground.apply(down)
        for p in up:
            msg = dict(p, delivered_at=t)
            self.onboard_messages.append(msg)
            for g in self.ground_messages:
                if g["id"] == msg["id"]:
                    g["delivered_at"] = t
            self.store.append("messages", msg.get("to"), t, msg)

    # ------------------------------------------------------------------ действия
    def start_scenario(self, scenario_id: str, target: str | None) -> dict:
        spec = self.cfg.scenarios[scenario_id]
        kind = spec.get("target", "astronaut")
        if kind == "astronaut":
            target = target if target in self.astronauts else "a3"
        elif kind == "module":
            target = target if target in self.modules else next(iter(self.modules))
        else:
            target = None
        t = self.clock.t
        sc = self.scenarios.start(scenario_id, target, t)
        if kind == "astronaut" and "nights" in spec:
            self._backfill_nights(self.astronauts[target], spec)
        return sc.to_dict(t)

    def _backfill_nights(self, a: AstronautState, spec: dict) -> None:
        """Сценарий на несколько ночей сразу дописывает историю, чтобы показать его за секунды."""
        sleep = self.scenarios.override(a.id, "sleep_h")
        fatigue = self.scenarios.override(a.id, "survey_fatigue")
        for i in range(spec["nights"]):
            if sleep is not None:
                a.sleep = (a.sleep + [float(sleep)])[-14:]
            if fatigue is not None:
                a.surveys = (a.surveys + [{"day": a.today, "mood": 5, "stress": 6, "fatigue": fatigue,
                                            "sleep_quality": 3, "source": "mock"}])[-30:]

    def acknowledge(self, alert_id: str, who: str) -> dict:
        a = self.alerts.acknowledge(alert_id, who, self.clock.t)
        self._drain_alert_events(self.clock.t)
        return a.to_dict()

    def resolve(self, alert_id: str, resolution: str) -> dict:
        a = self.alerts.resolve(alert_id, self.clock.t, resolution)
        run = self.guidance.runs.get(a.protocol_run_id or "")
        if run and run.status in ("in_progress", "rechecking"):
            run.status, run.finished_at = "closed", self.clock.t
            self._send_run(run, self.clock.t)
        self._drain_alert_events(self.clock.t)
        return a.to_dict()

    def mark_step(self, run_id: str, n: int, done: bool) -> dict:
        t = self.clock.t
        run, completed = self.guidance.mark_step(run_id, n, done, t)
        alert = self.alerts.alerts[run.alert_id]
        if alert.status == "active":
            self.alerts.acknowledge(alert.id, "protocol", t)
        if completed:
            on_done = self.guidance.on_done(run)
            astro = self._subject_astronaut(alert)
            module_id = alert.subject_id if alert.subject_type == "module" else None
            self.scenarios.recover(astro.id if astro else None, module_id, t)
            if "move_to" in on_done:
                movers = [astro] if astro else [x for x in self.astronauts.values() if x.module == module_id]
                for x in movers:
                    x.module = on_done["move_to"]
        self._send_run(run, t)
        self._drain_alert_events(t)
        return run.to_dict()

    def submit_survey(self, aid: str, mood: int, stress: int, fatigue: int, sleep_quality: int) -> dict:
        a = self.astronauts[aid]
        s = {"day": a.today, "mood": mood, "stress": stress, "fatigue": fatigue,
             "sleep_quality": sleep_quality, "source": "astronaut"}
        a.surveys = (a.surveys + [s])[-30:]
        self.store.append("surveys", aid, self.clock.t, s)
        return s

    def add_symptom(self, aid: str, kind: str, severity: int, note: str = "") -> dict:
        s = {"t": self.clock.t, "kind": kind, "severity": severity, "note": note}
        self.astronauts[aid].symptoms.append(s)
        self.store.append("symptoms", aid, self.clock.t, s)
        return s

    def add_exercise(self, aid: str, minutes: int, type_: str) -> dict:
        a = self.astronauts[aid]
        a.exercise_days[a.today] = a.exercise_days.get(a.today, 0) + minutes
        e = {"minutes": minutes, "type": type_, "source": "astronaut"}
        self.store.append("exercise_log", aid, self.clock.t, e)
        return e

    def move(self, aid: str, module_id: str) -> None:
        if module_id in self.modules:
            self.astronauts[aid].module = module_id

    def send_ground_message(self, text: str, to: str = "crew") -> dict:
        t = self.clock.t
        msg = {"id": f"msg_{next(self._msg_ids)}", "text": text, "to": to, "sent_at": t,
               "eta": t + self.link.delay_s, "delivered_at": None}
        self.ground_messages.append(msg)
        self.link.send_uplink(dict(msg), t)
        return msg

    # ------------------------------------------------------------------ снимки для экранов
    def _env_dict(self, mod: ModuleState) -> dict:
        e = mod.env
        return {"co2_mmhg": round(e["co2_mmhg"], 2), "co2_avg_1h": round(mod.co2_avg_1h(), 2),
                "o2_pct": round(e["o2_pct"], 2), "pressure_kpa": round(e["pressure_kpa"], 2),
                "pressure_rate_per_min": round(mod.pressure_rate_per_min(), 3),
                "temp_c": round(e["temp_c"], 1), "dose_rate_msv_day": round(e["dose_rate_msv_day"], 2),
                "base_dose_rate": mod.base_dose_rate}

    def astronaut_dict(self, a: AstronautState, full: bool = True) -> dict:
        d = {
            "id": a.id, "name": a.name, "role": a.role, "module": a.module, "note": a.note,
            "vitals": a.vitals, "quality_ok": a.quality_ok, "bad_metrics": a.bad_metrics,
            "news2": {"total": a.news2_total, "parts": a.news2_parts, "level": a.news2_level},
            "z": a.z, "at_rest": a.at_rest, "readiness": a.readiness, "status": self.astronaut_status(a),
            "dose": {"msv": round(a.dose_msv, 1),
                     "pct_limit": round(a.dose_msv / self.th["radiation"]["career_limit_msv"] * 100, 1),
                     "rate_msv_day": round(self.modules[a.module].env["dose_rate_msv_day"], 2)},
            "mission_day": a.mission_day,
        }
        if full:
            open_ids = {al.id for al in self.alerts.alerts.values()
                        if al.open and al.subject_type == "astronaut" and al.subject_id == a.id}
            open_ids |= {al.id for al in self.alerts.alerts.values()
                         if al.open and al.subject_type == "module" and al.subject_id == a.module}
            runs = self.guidance.active_for(open_ids)
            d.update({
                "baseline": a.baseline.to_dict(),
                "systems": body_systems(a, self.th),
                "sleep": a.sleep[-7:],
                "last_survey": a.last_survey(),
                "checked_in_today": a.checked_in_today,
                "exercise": {"today": a.exercise_today, "last_7d": a.exercise_7d(),
                             "plan_per_day": self.th["exercise"]["plan_min_per_day"]},
                "bone_loss_est_pct": round(a.bone_loss_pct(), 1),
                "symptoms": a.recent_symptoms(),
                "todo": daily_advice(a, self.th, runs),
            })
        return d

    def onboard_snapshot(self) -> dict:
        t = self.clock.t
        return {
            "type": "snapshot", "side": "onboard", "t": round(t, 1), "time": self.clock.iso(),
            "speed": self.clock.speed, "mission": self.mission_name,
            "crew": [self.astronaut_dict(a) for a in self.astronauts.values()],
            "modules": [{"id": m.id, "name": m.name, "crew": [a.id for a in self.astronauts.values() if a.module == m.id],
                         **self._env_dict(m)} for m in self.modules.values()],
            "alerts": [al.to_dict() for al in sorted(self.alerts.alerts.values(), key=lambda x: -x.created_at)
                       if al.open or t - (al.resolved_at or 0) < 3600][:50],
            "protocol_runs": [r.to_dict() for r in self.guidance.runs.values()][-50:],
            "link": self.link.status(),
            "messages": self.onboard_messages[-20:],
            "scenarios": [sc.to_dict(t) for sc in self.scenarios.active],
        }

    def ground_snapshot(self) -> dict:
        t = self.clock.t
        crew = []
        for aid, rec in self.ground.crew.items():
            crew.append({**rec, "age_s": round(t - rec["sample_t"], 1)})
        modules = [{**m, "age_s": round(t - m["sample_t"], 1)} for m in self.ground.modules.values()]
        return {
            "type": "snapshot", "side": "ground", "t": round(t, 1), "time": self.clock.iso(),
            "speed": self.clock.speed, "mission": self.mission_name,
            "crew": crew, "modules": modules,
            "alerts": sorted(self.ground.alerts.values(), key=lambda x: -x["created_at"])[:50],
            "protocol_runs": list(self.ground.runs.values())[-50:],
            "link": self.link.status(),
            "messages_sent": self.ground_messages[-20:],
        }
