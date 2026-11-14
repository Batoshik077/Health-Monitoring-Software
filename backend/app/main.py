"""Точка входа: FastAPI + фоновый цикл миссии + WebSocket-рассылка снимков."""
from __future__ import annotations

import asyncio
import contextlib
import os
import time

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.db import Store
from app.settings import DB_PATH, load_config
from app.state import Mission

TICK_REAL_S = 0.25
DEFAULT_SPEED = float(os.environ.get("ASTRO_SPEED", "1"))


class Hub:
    """Держит миссию, подписчиков WebSocket и фоновый цикл."""

    def __init__(self):
        self.cfg = load_config()
        self.store = Store(DB_PATH)
        self.mission = Mission(self.cfg, self.store, speed=DEFAULT_SPEED)
        self.clients: dict[str, set[WebSocket]] = {"onboard": set(), "ground": set()}
        self.task: asyncio.Task | None = None

    def reset(self, speed: float | None = None) -> None:
        self.store.clear()
        self.mission = Mission(self.cfg, self.store, speed=speed or self.mission.clock.speed)

    async def loop(self) -> None:
        last = time.monotonic()
        while True:
            await asyncio.sleep(TICK_REAL_S)
            now = time.monotonic()
            self.mission.advance(now - last)
            last = now
            await self.broadcast()

    async def broadcast(self) -> None:
        for side, sockets in self.clients.items():
            if not sockets:
                continue
            snap = self.mission.onboard_snapshot() if side == "onboard" else self.mission.ground_snapshot()
            for ws in list(sockets):
                try:
                    await ws.send_json(snap)
                except Exception:
                    sockets.discard(ws)


hub = Hub()


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    hub.task = asyncio.create_task(hub.loop())
    yield
    hub.task.cancel()


app = FastAPI(title="AstroHealth", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def M() -> Mission:
    return hub.mission


def _astro(aid: str):
    if aid not in M().astronauts:
        raise HTTPException(404, f"Нет астронавта {aid}")
    return M().astronauts[aid]


# ------------------------------------------------------------------ модели запросов
class SurveyIn(BaseModel):
    astronaut_id: str
    mood: int = Field(ge=0, le=10)
    stress: int = Field(ge=0, le=10)
    fatigue: int = Field(ge=0, le=10)
    sleep_quality: int = Field(ge=0, le=10)


class SymptomIn(BaseModel):
    astronaut_id: str
    kind: str
    severity: int = Field(ge=1, le=5)
    note: str = ""


class ExerciseIn(BaseModel):
    astronaut_id: str
    minutes: int = Field(gt=0, le=300)
    type: str = "mixed"


class AckIn(BaseModel):
    by: str = "crew"


class ResolveIn(BaseModel):
    resolution: str = "Закрыто вручную"


class StepIn(BaseModel):
    done: bool = True


class MoveIn(BaseModel):
    module: str


class MessageIn(BaseModel):
    text: str
    to: str = "crew"


class ScenarioIn(BaseModel):
    target: str | None = None


class ClockIn(BaseModel):
    speed: float = Field(gt=0, le=3600)


class LinkIn(BaseModel):
    up: bool | None = None
    profile: str | None = None
    delay_s: float | None = Field(default=None, ge=0)


# ------------------------------------------------------------------ астронавт
@app.get("/api/me/{aid}")
def me(aid: str):
    return M().astronaut_dict(_astro(aid))


@app.post("/api/surveys")
def survey(body: SurveyIn):
    _astro(body.astronaut_id)
    return M().submit_survey(body.astronaut_id, body.mood, body.stress, body.fatigue, body.sleep_quality)


@app.post("/api/symptoms")
def symptom(body: SymptomIn):
    _astro(body.astronaut_id)
    return M().add_symptom(body.astronaut_id, body.kind, body.severity, body.note)


@app.post("/api/exercise")
def exercise(body: ExerciseIn):
    _astro(body.astronaut_id)
    return M().add_exercise(body.astronaut_id, body.minutes, body.type)


@app.post("/api/crew/{aid}/module")
def move(aid: str, body: MoveIn):
    _astro(aid)
    if body.module not in M().modules:
        raise HTTPException(404, f"Нет модуля {body.module}")
    M().move(aid, body.module)
    return {"ok": True}


# ------------------------------------------------------------------ тревоги и протоколы
@app.get("/api/alerts")
def alerts(status: str | None = None):
    items = [a.to_dict() for a in M().alerts.alerts.values()]
    if status == "active":
        items = [a for a in items if a["status"] != "resolved"]
    elif status:
        items = [a for a in items if a["status"] == status]
    return sorted(items, key=lambda a: -a["created_at"])


@app.get("/api/alerts/{alert_id}")
def alert(alert_id: str):
    al = M().alerts.alerts.get(alert_id)
    if not al:
        raise HTTPException(404, "Нет такой тревоги")
    run = M().guidance.runs.get(al.protocol_run_id or "")
    return {"alert": al.to_dict(), "protocol_run": run.to_dict() if run else None}


@app.post("/api/alerts/{alert_id}/ack")
def ack(alert_id: str, body: AckIn):
    if alert_id not in M().alerts.alerts:
        raise HTTPException(404, "Нет такой тревоги")
    return M().acknowledge(alert_id, body.by)


@app.post("/api/alerts/{alert_id}/resolve")
def resolve(alert_id: str, body: ResolveIn):
    if alert_id not in M().alerts.alerts:
        raise HTTPException(404, "Нет такой тревоги")
    return M().resolve(alert_id, body.resolution)


@app.post("/api/protocol-runs/{run_id}/steps/{n}")
def step(run_id: str, n: int, body: StepIn):
    run = M().guidance.runs.get(run_id)
    if not run:
        raise HTTPException(404, "Нет такого протокола")
    if not 0 <= n < len(run.steps):
        raise HTTPException(400, "Нет такого шага")
    return M().mark_step(run_id, n, body.done)


# ------------------------------------------------------------------ экипаж и корабль
@app.get("/api/crew")
def crew():
    return [M().astronaut_dict(a, full=False) for a in M().astronauts.values()]


@app.get("/api/crew/{aid}")
def crew_member(aid: str):
    return M().astronaut_dict(_astro(aid))


@app.get("/api/crew/{aid}/history")
def history(aid: str, minutes: float = 60):
    a = _astro(aid)
    since = M().clock.t - minutes * 60
    return [h for h in a.history if h["t"] >= since]


@app.get("/api/environment")
def environment():
    return M().onboard_snapshot()["modules"]


@app.get("/api/link")
def link():
    return M().link.status()


@app.get("/api/snapshot")
def snapshot():
    return M().onboard_snapshot()


# ------------------------------------------------------------------ Земля
@app.get("/api/ground/snapshot")
def ground_snapshot():
    return M().ground_snapshot()


@app.post("/api/ground/messages")
def ground_message(body: MessageIn):
    return M().send_ground_message(body.text, body.to)


# ------------------------------------------------------------------ пульт сценариев
@app.get("/api/director/scenarios")
def scenarios():
    return [{"id": s["id"], "title": s.get("title", s["id"]), "description": s.get("description", ""),
             "target": s.get("target", "astronaut")} for s in hub.cfg.scenarios.values()]


@app.post("/api/director/scenario/{scenario_id}")
def start_scenario(scenario_id: str, body: ScenarioIn):
    if scenario_id not in hub.cfg.scenarios:
        raise HTTPException(404, "Нет такого сценария")
    return M().start_scenario(scenario_id, body.target)


@app.post("/api/director/scenarios/stop")
def stop_scenarios():
    t = M().clock.t
    for sc in M().scenarios.active:
        sc.recovery_start = sc.recovery_start or t
    return {"ok": True}


@app.post("/api/director/clock")
def clock(body: ClockIn):
    M().clock.speed = body.speed
    return {"speed": body.speed}


@app.post("/api/director/link")
def director_link(body: LinkIn):
    lk = M().link
    t = M().clock.t
    if body.profile:
        from app.link.channel import PROFILE_DELAYS
        lk.profile = body.profile
        lk.delay_s = PROFILE_DELAYS.get(body.profile, lk.delay_s)
    if body.delay_s is not None:
        lk.delay_s = body.delay_s
    if body.up is not None:
        lk.set_up(body.up, t)
    return lk.status()


@app.post("/api/director/reset")
def reset():
    hub.reset()
    return {"ok": True}


# ------------------------------------------------------------------ WebSocket
async def _ws(ws: WebSocket, side: str):
    await ws.accept()
    hub.clients[side].add(ws)
    snap = M().onboard_snapshot() if side == "onboard" else M().ground_snapshot()
    await ws.send_json(snap)
    try:
        while True:
            await ws.receive_text()  # входящие сообщения не нужны, держим соединение
    except WebSocketDisconnect:
        pass
    finally:
        hub.clients[side].discard(ws)


@app.websocket("/ws/onboard")
async def ws_onboard(ws: WebSocket):
    await _ws(ws, "onboard")


@app.websocket("/ws/ground")
async def ws_ground(ws: WebSocket):
    await _ws(ws, "ground")
