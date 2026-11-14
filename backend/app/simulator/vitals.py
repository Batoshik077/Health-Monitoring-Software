"""Мок-данные организма: личная норма + суточный ритм + шум + тренировки."""
from __future__ import annotations

import math
import random

from app.clock import SimClock

SESSION_S = 3600  # тренировка 60 минут


class VitalsGenerator:
    def __init__(self, astronaut: dict, rng: random.Random):
        self.id = astronaut["id"]
        self.base = dict(astronaut["baseline"])
        self.exercise_hours = list(astronaut.get("exercise_hours", [9, 16]))
        self.rng = rng
        self.noise = {k: 0.0 for k in ("hr", "spo2", "rr", "sbp", "temp")}
        self.sigma = {"hr": 1.5, "spo2": 0.4, "rr": 0.5, "sbp": 3.0, "temp": 0.05}

    def activity(self, t: float) -> float:
        """0 — покой, 1 — интенсивная тренировка. Плавный вход и выход за 5 минут."""
        hour = SimClock.hour_of_day(t)
        for h in self.exercise_hours:
            into = (hour - h) * 3600
            if 0 <= into <= SESSION_S:
                edge = min(into, SESSION_S - into)
                return min(1.0, edge / 300)
        return 0.0

    def finished_sessions(self, t_prev: float, t_now: float) -> int:
        """Сколько тренировок закончилось между двумя моментами (для журнала)."""
        count = 0
        for h in self.exercise_hours:
            end_hour = (h + SESSION_S / 3600) % 24
            hp, hn = SimClock.hour_of_day(t_prev), SimClock.hour_of_day(t_now)
            if hp <= hn:
                crossed = hp < end_hour <= hn
            else:  # переход через полночь
                crossed = end_hour > hp or end_hour <= hn
            if crossed and t_now - t_prev < 12 * 3600:
                count += 1
        return count

    def _step_noise(self, dt: float) -> None:
        # AR(1): шум «плывёт», а не скачет. Коэффициент зависит от шага времени.
        rho = math.exp(-dt / 10.0)
        for k, s in self.sigma.items():
            self.noise[k] = rho * self.noise[k] + math.sqrt(1 - rho * rho) * s * self.rng.gauss(0, 1)

    def sample(self, t: float, dt: float) -> dict:
        self._step_noise(dt)
        hour = SimClock.hour_of_day(t)
        circadian = math.sin(2 * math.pi * (hour - 10) / 24)  # максимум днём
        asleep = hour >= 23 or hour < 7
        act = self.activity(t)
        b, n = self.base, self.noise
        return {
            "hr": b["hr"] + 3 * circadian - (3 if asleep else 0) + 45 * act + n["hr"],
            "spo2": min(100.0, b["spo2"] + n["spo2"]),
            "rr": b["rr"] + 8 * act + n["rr"],
            "sbp": b["sbp"] + 20 * act + 3 * circadian + n["sbp"],
            "temp": b["temp"] + 0.3 * circadian + n["temp"],
            "activity": act,
        }


def round_vitals(v: dict) -> dict:
    out = {}
    for k, val in v.items():
        if val is None:
            out[k] = None
        elif k == "temp":
            out[k] = round(val, 1)
        elif k == "activity":
            out[k] = round(val, 2)
        else:
            out[k] = int(round(val))
    return out
