"""Мок-данные среды по модулям корабля: CO₂, O₂, давление, радиация."""
from __future__ import annotations

import random

PROFILE_DOSE_KEY = {"iss": "iss", "moon": "mars_transit", "mars": "mars_transit"}


class EnvironmentGenerator:
    def __init__(self, module: dict, base_dose_rate: float, rng: random.Random):
        self.id = module["id"]
        self.base = {
            "co2_mmhg": module["co2_mmhg"],
            "o2_pct": module["o2_pct"],
            "pressure_kpa": module["pressure_kpa"],
            "temp_c": module.get("temp_c", 22.0),
            "dose_rate_msv_day": base_dose_rate,
        }
        self.rng = rng
        self.co2_drift = 0.0

    def sample(self, dt: float) -> dict:
        # CO₂ медленно «гуляет» вокруг базового значения
        self.co2_drift += self.rng.gauss(0, 0.01) * min(dt, 60) ** 0.5
        self.co2_drift *= 0.995
        b = self.base
        return {
            "co2_mmhg": max(0.1, b["co2_mmhg"] + self.co2_drift),
            "o2_pct": b["o2_pct"] + self.rng.gauss(0, 0.05),
            "pressure_kpa": b["pressure_kpa"] + self.rng.gauss(0, 0.02),
            "temp_c": b["temp_c"] + self.rng.gauss(0, 0.1),
            "dose_rate_msv_day": b["dose_rate_msv_day"] * (1 + self.rng.gauss(0, 0.03)),
        }
