"""Guidance: протоколы действий по тревогам и ежедневные советы.

Каждая тревога с протоколом получает «прохождение» (ProtocolRun): астронавт отмечает шаги,
после последнего шага через recheck_after_s система проверяет, стало ли лучше.
Лучше = правило тревоги больше не срабатывает.
"""
from __future__ import annotations

import itertools
from dataclasses import asdict, dataclass, field


@dataclass
class ProtocolRun:
    id: str
    alert_id: str
    protocol_id: str
    title: str
    explain: str
    steps: list[str]
    call: str
    success_hint: str
    recheck_after_s: float
    escalate_if_not: str
    started_at: float
    steps_done: list[bool] = field(default_factory=list)
    status: str = "in_progress"  # in_progress | rechecking | improved | not_improved
    recheck_at: float | None = None
    finished_at: float | None = None

    def to_dict(self) -> dict:
        return asdict(self)


class Guidance:
    def __init__(self, protocols: dict[str, dict]):
        self.protocols = protocols
        self.runs: dict[str, ProtocolRun] = {}
        self._ids = itertools.count(1)

    def start(self, alert, t: float) -> ProtocolRun | None:
        spec = self.protocols.get(alert.protocol_id or "")
        if not spec:
            return None
        run = ProtocolRun(
            id=f"pr_{next(self._ids)}", alert_id=alert.id, protocol_id=spec["id"], title=spec["title"],
            explain=spec.get("explain", ""), steps=list(spec["steps"]), call=spec.get("call", "none"),
            success_hint=spec.get("success", ""), recheck_after_s=float(spec.get("recheck_after_s", 120)),
            escalate_if_not=spec.get("escalate_if_not", "cmo"), started_at=t,
            steps_done=[False] * len(spec["steps"]),
        )
        self.runs[run.id] = run
        alert.protocol_run_id = run.id
        return run

    def mark_step(self, run_id: str, n: int, done: bool, t: float) -> tuple[ProtocolRun, bool]:
        """Возвращает (run, только_что_завершён)."""
        run = self.runs[run_id]
        if run.status != "in_progress":
            return run, False
        run.steps_done[n] = done
        if all(run.steps_done):
            run.status = "rechecking"
            run.recheck_at = t + run.recheck_after_s
            return run, True
        return run, False

    def on_done(self, run: ProtocolRun) -> dict:
        return self.protocols[run.protocol_id].get("on_done", {}) or {}

    def due_rechecks(self, t: float) -> list[ProtocolRun]:
        return [r for r in self.runs.values() if r.status == "rechecking" and r.recheck_at <= t]

    def active_for(self, alert_ids: set[str]) -> list[ProtocolRun]:
        return [r for r in self.runs.values() if r.alert_id in alert_ids]


def daily_advice(a, th: dict, open_runs: list[ProtocolRun]) -> list[dict]:
    """«Что сделать сегодня» для экрана «Моё здоровье»."""
    todo = []
    for r in open_runs:
        if r.status in ("in_progress", "rechecking"):
            todo.append({"kind": "protocol", "text": f"Пройти протокол: {r.title}", "run_id": r.id,
                         "alert_id": r.alert_id, "priority": 0})
    if not a.checked_in_today:
        todo.append({"kind": "checkin", "text": "Пройти ежедневную самопроверку (30 секунд)", "priority": 1})
    plan = th["exercise"]["plan_min_per_day"]
    if a.exercise_today < plan:
        todo.append({"kind": "exercise", "text": f"Тренировка: осталось {plan - a.exercise_today} мин из {plan}",
                     "priority": 2})
    if a.sleep and a.sleep[-1] < 7:
        todo.append({"kind": "sleep", "text": "Лечь спать вовремя: плановая норма NASA — 8.5 ч", "priority": 3})
    return sorted(todo, key=lambda x: x["priority"])
