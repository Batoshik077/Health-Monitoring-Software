"""SimClock — общие часы миссии. Все модули берут время отсюда, а не у системы."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

MISSION_EPOCH = datetime(2031, 3, 4, 8, 0, tzinfo=timezone.utc)  # старт в 08:00, экипаж бодрствует
DAY = 86400.0
WAKE_HOUR = 7  # подъём: в это время записывается сон за прошедшую ночь


class SimClock:
    def __init__(self, speed: float = 1.0):
        self.t = 0.0  # секунды с начала симуляции
        self.speed = speed

    def advance(self, real_dt: float) -> float:
        dt = real_dt * self.speed
        self.t += dt
        return dt

    def iso(self, t: float | None = None) -> str:
        t = self.t if t is None else t
        return (MISSION_EPOCH + timedelta(seconds=t)).isoformat().replace("+00:00", "Z")

    @staticmethod
    def hour_of_day(t: float) -> float:
        return ((MISSION_EPOCH.hour * 3600 + t) % DAY) / 3600

    @staticmethod
    def day_index(t: float) -> int:
        """Номер «дня» миссии, который начинается в момент подъёма."""
        return int((MISSION_EPOCH.hour * 3600 + t - WAKE_HOUR * 3600) // DAY)
