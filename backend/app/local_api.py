"""API миссии без сервера — для браузерной сборки (Pyodide на Vercel).

Повторяет маршруты app/main.py, но вызывается напрямую из Web Worker:
    app = LocalApp()
    app.tick(0.25)                       # продвинуть время
    app.snapshots()                      # JSON со снимками борта и Земли
    app.request("POST", "/api/...", "{}")  # JSON {"status": 200, "body": ...}
"""
from __future__ import annotations

import json
import re

from app.link.channel import PROFILE_DELAYS
from app.settings import load_config
from app.state import Mission


class HttpError(Exception):
    def __init__(self, status: int, detail: str):
        super().__init__(detail)
        self.status, self.detail = status, detail


def _int(body: dict, key: str, lo: int, hi: int, default: int | None = None) -> int:
    v = body.get(key, default)
    if not isinstance(v, int) or not lo <= v <= hi:
        raise HttpError(422, f"{key}: нужно целое от {lo} до {hi}")
    return v


class LocalApp:
    def __init__(self, speed: float = 1.0):
        self.cfg = load_config()
        self.mission = Mission(self.cfg, speed=speed)
        self.routes = [
            ("GET", r"/api/me/(\w+)", self._me),
            ("POST", r"/api/surveys", self._survey),
            ("POST", r"/api/symptoms", self._symptom),
            ("POST", r"/api/exercise", self._exercise),
            ("POST", r"/api/crew/(\w+)/module", self._move),
            ("GET", r"/api/alerts", self._alerts),
            ("GET", r"/api/alerts/(\w+)", self._alert),
            ("POST", r"/api/alerts/(\w+)/ack", self._ack),
            ("POST", r"/api/alerts/(\w+)/resolve", self._resolve),
            ("POST", r"/api/protocol-runs/(\w+)/steps/(\d+)", self._step),
            ("GET", r"/api/crew", self._crew),
            ("GET", r"/api/crew/(\w+)", self._me),
            ("GET", r"/api/crew/(\w+)/history", self._history),
            ("GET", r"/api/environment", lambda b, q: self.mission.onboard_snapshot()["modules"]),
            ("GET", r"/api/link", lambda b, q: self.mission.link.status()),
            ("GET", r"/api/snapshot", lambda b, q: self.mission.onboard_snapshot()),
            ("GET", r"/api/ground/snapshot", lambda b, q: self.mission.ground_snapshot()),
            ("POST", r"/api/ground/messages", self._message),
            ("GET", r"/api/director/scenarios", self._scenarios),
            ("POST", r"/api/director/scenario/(\w+)", self._start),
            ("POST", r"/api/director/scenarios/stop", self._stop),
            ("POST", r"/api/director/clock", self._clock),
            ("POST", r"/api/director/link", self._link),
            ("POST", r"/api/director/reset", self._reset),
        ]

    # ---------------------------------------------------------------- вход из Web Worker
    def tick(self, real_dt: float) -> None:
        self.mission.advance(min(real_dt, 2.0))  # вкладка могла «спать» — не догоняем часами

    def snapshots(self) -> str:
        return json.dumps({"onboard": self.mission.onboard_snapshot(), "ground": self.mission.ground_snapshot()},
                          ensure_ascii=False)

    def request(self, method: str, url: str, body_json: str = "") -> str:
        path, _, query = url.partition("?")
        q = dict(p.split("=", 1) for p in query.split("&") if "=" in p)
        try:
            body = json.loads(body_json) if body_json else {}
            for m, pattern, handler in self.routes:
                match = re.fullmatch(pattern, path)
                if m == method and match:
                    return json.dumps({"status": 200, "body": handler(body, q, *match.groups())}, ensure_ascii=False)
            raise HttpError(404, f"Нет маршрута {method} {path}")
        except HttpError as e:
            return json.dumps({"status": e.status, "body": {"detail": e.detail}}, ensure_ascii=False)

    # ---------------------------------------------------------------- маршруты
    def _astro(self, aid: str):
        if aid not in self.mission.astronauts:
            raise HttpError(404, f"Нет астронавта {aid}")
        return self.mission.astronauts[aid]

    def _me(self, b, q, aid):
        return self.mission.astronaut_dict(self._astro(aid))

    def _crew(self, b, q):
        return [self.mission.astronaut_dict(a, full=False) for a in self.mission.astronauts.values()]

    def _history(self, b, q, aid):
        a = self._astro(aid)
        since = self.mission.clock.t - float(q.get("minutes", 60)) * 60
        return [h for h in a.history if h["t"] >= since]

    def _survey(self, b, q):
        self._astro(b.get("astronaut_id", ""))
        return self.mission.submit_survey(b["astronaut_id"], _int(b, "mood", 0, 10), _int(b, "stress", 0, 10),
                                          _int(b, "fatigue", 0, 10), _int(b, "sleep_quality", 0, 10))

    def _symptom(self, b, q):
        self._astro(b.get("astronaut_id", ""))
        return self.mission.add_symptom(b["astronaut_id"], str(b.get("kind", "")), _int(b, "severity", 1, 5),
                                        str(b.get("note", "")))

    def _exercise(self, b, q):
        self._astro(b.get("astronaut_id", ""))
        return self.mission.add_exercise(b["astronaut_id"], _int(b, "minutes", 1, 300), str(b.get("type", "mixed")))

    def _move(self, b, q, aid):
        self._astro(aid)
        if b.get("module") not in self.mission.modules:
            raise HttpError(404, f"Нет модуля {b.get('module')}")
        self.mission.move(aid, b["module"])
        return {"ok": True}

    def _alerts(self, b, q):
        items = [a.to_dict() for a in self.mission.alerts.alerts.values()]
        status = q.get("status")
        if status == "active":
            items = [a for a in items if a["status"] != "resolved"]
        elif status:
            items = [a for a in items if a["status"] == status]
        return sorted(items, key=lambda a: -a["created_at"])

    def _get_alert(self, alert_id):
        al = self.mission.alerts.alerts.get(alert_id)
        if not al:
            raise HttpError(404, "Нет такой тревоги")
        return al

    def _alert(self, b, q, alert_id):
        al = self._get_alert(alert_id)
        run = self.mission.guidance.runs.get(al.protocol_run_id or "")
        return {"alert": al.to_dict(), "protocol_run": run.to_dict() if run else None}

    def _ack(self, b, q, alert_id):
        self._get_alert(alert_id)
        return self.mission.acknowledge(alert_id, str(b.get("by", "crew")))

    def _resolve(self, b, q, alert_id):
        self._get_alert(alert_id)
        return self.mission.resolve(alert_id, str(b.get("resolution", "Закрыто вручную")))

    def _step(self, b, q, run_id, n):
        run = self.mission.guidance.runs.get(run_id)
        if not run:
            raise HttpError(404, "Нет такого протокола")
        n = int(n)
        if not 0 <= n < len(run.steps):
            raise HttpError(400, "Нет такого шага")
        return self.mission.mark_step(run_id, n, bool(b.get("done", True)))

    def _message(self, b, q):
        text = str(b.get("text", "")).strip()
        if not text:
            raise HttpError(422, "Пустое сообщение")
        return self.mission.send_ground_message(text, str(b.get("to", "crew")))

    def _scenarios(self, b, q):
        return [{"id": s["id"], "title": s.get("title", s["id"]), "description": s.get("description", ""),
                 "target": s.get("target", "astronaut")} for s in self.cfg.scenarios.values()]

    def _start(self, b, q, scenario_id):
        if scenario_id not in self.cfg.scenarios:
            raise HttpError(404, "Нет такого сценария")
        return self.mission.start_scenario(scenario_id, b.get("target"))

    def _stop(self, b, q):
        t = self.mission.clock.t
        for sc in self.mission.scenarios.active:
            sc.recovery_start = sc.recovery_start or t
        return {"ok": True}

    def _clock(self, b, q):
        speed = b.get("speed")
        if not isinstance(speed, (int, float)) or not 0 < speed <= 3600:
            raise HttpError(422, "speed: от 0 до 3600")
        self.mission.clock.speed = float(speed)
        return {"speed": speed}

    def _link(self, b, q):
        lk, t = self.mission.link, self.mission.clock.t
        if b.get("profile"):
            lk.profile = b["profile"]
            lk.delay_s = PROFILE_DELAYS.get(b["profile"], lk.delay_s)
        if b.get("delay_s") is not None:
            lk.delay_s = float(b["delay_s"])
        if b.get("up") is not None:
            lk.set_up(bool(b["up"]), t)
        return lk.status()

    def _reset(self, b, q):
        self.mission = Mission(self.cfg, speed=self.mission.clock.speed)
        return {"ok": True}
