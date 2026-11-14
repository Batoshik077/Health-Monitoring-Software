"""Индекс готовности 0–100 и статус по системам организма.

Формулы — [решение команды] для прототипа, не медицинская методика.
"""
from __future__ import annotations

GREEN, YELLOW, RED = "green", "yellow", "red"
ORDER = {GREEN: 0, YELLOW: 1, RED: 2}


def worst(*statuses: str) -> str:
    return max(statuses, key=lambda s: ORDER[s])


def readiness(news2_total: int, sleep: list[float], survey: dict | None, z_hr: float | None, at_rest: bool) -> int:
    r = 100.0
    r -= 6 * news2_total
    if sleep:
        if sleep[-1] < 7:
            r -= (7 - sleep[-1]) * 8
        last3 = sleep[-3:]
        if len(last3) == 3 and sum(last3) / 3 < 6:
            r -= 10
    if survey:
        r -= max(0, survey.get("fatigue", 0) - 5) * 4
        r -= max(0, survey.get("stress", 0) - 5) * 3
        r -= max(0, 5 - survey.get("mood", 5)) * 3
    if at_rest and z_hr is not None and z_hr > 2:
        r -= min(15, 5 * (z_hr - 2))
    return int(max(0, min(100, round(r))))


def _from_points(points: int) -> str:
    return RED if points >= 3 else YELLOW if points >= 1 else GREEN


def _vital_status(a, keys: tuple[str, ...]) -> str:
    """1 балл NEWS2 не тревожит, если показатель в пределах личной нормы (|z| ≤ 2)."""
    out = GREEN
    for k in keys:
        p = a.news2_parts[k]
        z = a.z.get(k)
        if p == 1 and z is not None and abs(z) <= 2:
            p = 0
        out = worst(out, _from_points(p))
    return out


def body_systems(a, th: dict) -> dict:
    """a — AstronautState. Возвращает статус и короткое пояснение по 6 системам."""
    v, parts = a.vitals, a.news2_parts
    z_hr = a.z.get("hr")

    cardio = _vital_status(a, ("hr", "sbp"))
    if a.at_rest and z_hr is not None and z_hr > th["baseline"]["z_warning"]:
        cardio = worst(cardio, YELLOW)

    resp = _vital_status(a, ("spo2", "rr"))

    plan = th["exercise"]["plan_min_per_day"] * 7
    ex = a.exercise_7d()
    ratio = ex / plan if plan else 1
    bone = GREEN if ratio >= 0.9 else YELLOW if ratio >= th["exercise"]["deficit_fraction"] else RED

    behav = GREEN
    s = a.last_survey()
    if s and (s["stress"] >= 7 or s["fatigue"] >= 7 or s["mood"] <= 3):
        behav = YELLOW
    sleep3 = a.sleep[-3:]
    if sleep3 and sum(sleep3) / len(sleep3) < th["sleep"]["warning_hours"]:
        behav = RED if behav == YELLOW else YELLOW

    immune = {0: GREEN, 1: YELLOW, 2: RED, 3: RED}[parts["temp"]]
    if a.recent_symptoms():
        immune = worst(immune, YELLOW)

    rad_cfg = th["radiation"]
    pct = a.dose_msv / rad_cfg["career_limit_msv"]
    rad = GREEN if pct < rad_cfg["warning_fraction"] else YELLOW if pct < rad_cfg["critical_fraction"] else RED
    if a.dose_rate_spike:
        rad = RED

    return {
        "cardio": {"title": "Сердце и сосуды", "status": cardio,
                   "detail": f"пульс {v.get('hr')}, давление {v.get('sbp')}"},
        "respiratory": {"title": "Дыхание и кислород", "status": resp,
                        "detail": f"SpO₂ {v.get('spo2')} %, дыхание {v.get('rr')}/мин"},
        "bone_muscle": {"title": "Кости и мышцы", "status": bone,
                        "detail": f"тренировки за 7 дн: {ex} из {plan} мин; оценка потери МПК ~{a.bone_loss_pct():.1f} %"},
        "behavioral": {"title": "Психика и сон", "status": behav,
                       "detail": f"сон {a.sleep[-1]:.1f} ч" + (f", стресс {s['stress']}/10" if s else "")},
        "immune": {"title": "Иммунитет", "status": immune,
                   "detail": f"температура {v.get('temp')} °C" + (", есть симптомы" if a.recent_symptoms() else "")},
        "radiation": {"title": "Радиация", "status": rad,
                      "detail": f"{a.dose_msv:.0f} мЗв, {pct * 100:.0f} % лимита"},
    }
