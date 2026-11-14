"""Личная норма астронавта: скользящее среднее и разброс (EWMA), z-score.

Стартовые значения берутся из crew.yaml (как будто система уже выучила норму
за первые дни миссии). Норма обновляется только когда значение не аномальное,
чтобы тревога не «переучила» базовую линию.
"""
from __future__ import annotations

import math

DEFAULT_STD = {"hr": 4.0, "spo2": 0.8, "rr": 1.5, "sbp": 6.0, "temp": 0.25}
ALPHA_PER_SECOND = 1 / (6 * 3600)  # память примерно 6 часов


class Baseline:
    def __init__(self, baseline: dict):
        self.mean = {k: float(baseline[k]) for k in DEFAULT_STD}
        self.var = {k: DEFAULT_STD[k] ** 2 for k in DEFAULT_STD}

    def std(self, metric: str) -> float:
        return max(math.sqrt(self.var[metric]), DEFAULT_STD[metric] * 0.5)

    def z(self, metric: str, value: float | None) -> float | None:
        if value is None:
            return None
        return (value - self.mean[metric]) / self.std(metric)

    def update(self, vitals: dict, dt: float, at_rest: bool) -> None:
        if not at_rest:
            return
        a = min(0.5, ALPHA_PER_SECOND * dt)
        for k in DEFAULT_STD:
            v = vitals.get(k)
            z = self.z(k, v)
            if v is None or z is None or abs(z) > 2:
                continue
            diff = v - self.mean[k]
            self.mean[k] += a * diff
            self.var[k] = (1 - a) * (self.var[k] + a * diff * diff)

    def to_dict(self) -> dict:
        return {k: {"mean": round(self.mean[k], 1), "std": round(self.std(k), 2)} for k in DEFAULT_STD}
