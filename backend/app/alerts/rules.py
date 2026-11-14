"""Правила тревог. Пороги — из config/thresholds.yaml.

Правила одной группы (например spo2_warning и spo2_critical) дают ОДНУ тревогу,
которая повышает уровень, если срабатывает более строгое правило.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

SEVERITY_ORDER = {"info": 0, "warning": 1, "critical": 2}


@dataclass
class Rule:
    id: str
    group: str
    severity: str
    scope: str  # astronaut | module
    sustain_s: float
    check: Callable  # (subject, th) -> str | None  (сообщение, если условие выполнено)


def _vital_ok(a) -> bool:
    return a.quality_ok


def build_rules(th: dict) -> list[Rule]:
    v = th["vitals"]
    env = th["environment"]
    rad = th["radiation"]
    base = th["baseline"]
    lv = th["news2_levels"]
    ex = th["exercise"]
    sleep = th["sleep"]
    R: list[Rule] = []

    def add(id, group, severity, scope, sustain, check):
        R.append(Rule(id, group, severity, scope, sustain, check))

    # --- качество сигнала (не медицинская тревога)
    add("sensor_quality", "sensor", "warning", "astronaut", 10,
        lambda a, th: None if a.quality_ok else f"Датчик выдаёт невозможные значения или нет данных: {', '.join(a.bad_metrics)}")

    # --- кислород
    add("spo2_critical", "spo2", "critical", "astronaut", v["spo2"]["sustain_s"],
        lambda a, th: _vital_ok(a) and a.vitals["spo2"] <= v["spo2"]["critical_max"]
        and f"SpO₂ {a.vitals['spo2']} % — ниже {v['spo2']['critical_max']} % дольше {v['spo2']['sustain_s']} с" or None)
    add("spo2_warning", "spo2", "warning", "astronaut", v["spo2"]["sustain_s"],
        lambda a, th: _vital_ok(a) and a.vitals["spo2"] < v["spo2"]["warning_min"]
        and f"SpO₂ {a.vitals['spo2']} % — ниже {v['spo2']['warning_min']} % (3 балла NEWS2)" or None)

    # --- пульс, дыхание, давление, температура (один параметр на 3 балла NEWS2 → WARNING)
    hr = v["heart_rate"]
    add("hr_extreme", "hr", "warning", "astronaut", hr["sustain_s"],
        lambda a, th: _vital_ok(a) and (a.vitals["hr"] >= hr["critical_high"] or a.vitals["hr"] <= hr["critical_low"])
        and f"Пульс {a.vitals['hr']} уд/мин — вне диапазона {hr['critical_low'] + 1}–{hr['critical_high'] - 1}" or None)
    rr = v["resp_rate"]
    add("rr_extreme", "rr", "warning", "astronaut", rr["sustain_s"],
        lambda a, th: _vital_ok(a) and (a.vitals["rr"] >= rr["critical_high"] or a.vitals["rr"] <= rr["critical_low"])
        and f"Частота дыхания {a.vitals['rr']}/мин — вне нормы" or None)
    bp = v["systolic_bp"]
    add("sbp_extreme", "sbp", "warning", "astronaut", bp["sustain_s"],
        lambda a, th: _vital_ok(a) and (a.vitals["sbp"] >= bp["critical_high"] or a.vitals["sbp"] <= bp["critical_low"])
        and f"Систолическое давление {a.vitals['sbp']} мм рт. ст. — вне нормы" or None)
    tc = v["temperature"]
    add("fever", "temp", "warning", "astronaut", 600,
        lambda a, th: _vital_ok(a) and a.vitals["temp"] >= tc["info"][1][0]
        and f"Температура {a.vitals['temp']} °C — выше нормы" or None)
    add("hypothermia", "temp", "warning", "astronaut", tc["sustain_s"],
        lambda a, th: _vital_ok(a) and a.vitals["temp"] <= tc["critical_low"]
        and f"Температура {a.vitals['temp']} °C — ниже нормы" or None)

    # --- общий балл NEWS2
    add("news2_critical", "news2", "critical", "astronaut", 60,
        lambda a, th: _vital_ok(a) and a.news2_total >= lv["critical"]
        and f"Сумма баллов NEWS2 = {a.news2_total}: несколько показателей вне нормы" or None)
    add("news2_warning", "news2", "warning", "astronaut", 120,
        lambda a, th: _vital_ok(a) and a.news2_total >= lv["warning"]
        and f"Сумма баллов NEWS2 = {a.news2_total}" or None)

    # --- личная норма
    add("baseline_hr", "baseline_hr", "warning", "astronaut", 300,
        # личная норма ловит то, что NEWS2 пропускает, поэтому срабатывает только при «нормальном» NEWS2
        lambda a, th: _vital_ok(a) and a.at_rest and a.news2_level in ("normal", "info")
        and a.z.get("hr") is not None and a.z["hr"] > base["z_warning"]
        and (f"Пульс в покое {a.vitals['hr']} — обычно у вас {a.baseline.mean['hr']:.0f} "
             f"(отклонение {a.z['hr']:.1f} σ). По общим нормам это может быть норма, но не для вас.") or None)

    # --- сон, готовность, психика, тренировки
    add("sleep_debt", "sleep", "warning", "astronaut", 0,
        lambda a, th: len(a.sleep) >= sleep["warning_nights_in_row"]
        and all(s < sleep["warning_hours"] for s in a.sleep[-sleep["warning_nights_in_row"]:])
        and f"Меньше {sleep['warning_hours']} ч сна {sleep['warning_nights_in_row']} ночи подряд" or None)
    add("readiness_low", "readiness", "warning", "astronaut", 3600,
        lambda a, th: a.readiness < 50 and f"Индекс готовности {a.readiness} — ниже 50" or None)
    add("stress_high", "mood", "info", "astronaut", 0,
        lambda a, th: len(a.surveys) >= 2
        and all(s["stress"] >= 7 or s["fatigue"] >= 7 for s in a.surveys[-2:])
        and "Стресс или усталость 7/10 и выше два дня подряд" or None)
    add("mood_low", "mood", "info", "astronaut", 0,
        lambda a, th: len(a.surveys) >= 2 and all(s["mood"] <= 3 for s in a.surveys[-2:])
        and "Настроение 3/10 и ниже два дня подряд" or None)
    add("exercise_deficit", "exercise", "info", "astronaut", 0,
        lambda a, th: a.exercise_7d() < ex["plan_min_per_day"] * 7 * ex["deficit_fraction"]
        and f"Тренировки за 7 дней: {a.exercise_7d()} мин — меньше {int(ex['deficit_fraction'] * 100)} % плана" or None)

    # --- радиация (накопленная доза)
    add("radiation_budget_critical", "radiation_budget", "critical", "astronaut", 0,
        lambda a, th: a.dose_msv >= rad["career_limit_msv"] * rad["critical_fraction"]
        and f"Накопленная доза {a.dose_msv:.0f} мЗв — больше {int(rad['critical_fraction'] * 100)} % карьерного лимита" or None)
    add("radiation_budget_warning", "radiation_budget", "warning", "astronaut", 0,
        lambda a, th: a.dose_msv >= rad["career_limit_msv"] * rad["warning_fraction"]
        and f"Накопленная доза {a.dose_msv:.0f} мЗв — больше {int(rad['warning_fraction'] * 100)} % карьерного лимита" or None)

    # --- среда в модулях
    co2 = env["co2_mmhg"]
    add("co2_critical", "co2", "critical", "module", 60,
        lambda m, th: m.env["co2_mmhg"] >= co2["critical"]
        and f"CO₂ {m.env['co2_mmhg']:.1f} мм рт. ст. — критически высокий" or None)
    add("co2_warning", "co2", "warning", "module", 0,
        lambda m, th: m.co2_avg_1h() > co2["avg_1h_warning"]
        and f"CO₂ в среднем за час {m.co2_avg_1h():.1f} мм рт. ст. — выше нормы {co2['avg_1h_warning']} (NASA-STD-3001)" or None)
    o2 = env["o2_percent"]
    add("o2_critical", "o2", "critical", "module", 30,
        lambda m, th: m.env["o2_pct"] < o2["critical_below"] and f"O₂ {m.env['o2_pct']:.1f} % — критически мало" or None)
    add("o2_low", "o2", "warning", "module", 60,
        lambda m, th: m.env["o2_pct"] < o2["warning_below"] and f"O₂ {m.env['o2_pct']:.1f} % — ниже нормы" or None)
    cab = env["cabin_kpa"]
    add("cabin_pressure_critical", "cabin_pressure", "critical", "module", 30,
        lambda m, th: m.pressure_rate_per_min() < -cab["critical_rate_per_min"]
        and f"Давление падает на {-m.pressure_rate_per_min():.2f} кПа/мин — возможна утечка" or None)
    add("cabin_pressure_warning", "cabin_pressure", "warning", "module", 30,
        lambda m, th: cab["nominal"] - m.env["pressure_kpa"] > cab["warning_drop"]
        and f"Давление {m.env['pressure_kpa']:.1f} кПа — ниже номинала на {cab['nominal'] - m.env['pressure_kpa']:.1f}" or None)
    add("radiation_spike", "radiation_spike", "critical", "module", 60,
        lambda m, th: m.env["dose_rate_msv_day"] > m.base_dose_rate * rad["spike_multiplier"]
        and f"Мощность дозы {m.env['dose_rate_msv_day']:.1f} мЗв/сут — в {m.env['dose_rate_msv_day'] / m.base_dose_rate:.0f} раз выше обычной (вероятна солнечная вспышка)" or None)
    return R
