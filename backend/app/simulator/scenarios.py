"""Сценарии ЧП из config/scenarios/*.yaml, которые накладываются поверх мок-данных.

Сила эффекта = прогресс нарастания × (1 − прогресс восстановления).
"""
from __future__ import annotations

import itertools
from dataclasses import dataclass, field

DEFAULT_RECOVERY_S = 60
_ids = itertools.count(1)


@dataclass
class ActiveScenario:
    id: str
    spec: dict
    target: str | None  # id астронавта или модуля; None для all/link
    start: float
    recovery_start: float | None = None
    uid: int = field(default_factory=lambda: next(_ids))

    @property
    def kind(self) -> str:
        return self.spec.get("target", "astronaut")

    @property
    def duration(self) -> float:
        if "nights" in self.spec:
            return self.spec["nights"] * 86400
        return float(self.spec.get("duration_s", 600))

    @property
    def recovery_s(self) -> float:
        return float(self.spec.get("recovery", {}).get("ramp_s", DEFAULT_RECOVERY_S))

    @property
    def waits_for_protocol(self) -> bool:
        return self.spec.get("recovery", {}).get("trigger") == "protocol_done"

    def recovery_factor(self, t: float) -> float:
        if self.recovery_start is None:
            return 1.0
        return max(0.0, 1 - (t - self.recovery_start) / self.recovery_s)

    def effect_factor(self, effect: dict, t: float) -> float:
        elapsed = t - self.start
        ramp = effect.get("ramp_s", 0)
        ramp_f = 1.0 if not ramp else min(1.0, max(0.0, elapsed / ramp))
        return ramp_f * self.recovery_factor(t)

    def to_dict(self, t: float) -> dict:
        return {
            "uid": self.uid,
            "id": self.id,
            "title": self.spec.get("title", self.id),
            "target": self.target,
            "elapsed_s": round(t - self.start),
            "recovering": self.recovery_start is not None,
        }


def _apply(value, effect: dict, f: float, elapsed: float):
    if value is None:
        return None
    if "to" in effect:
        return value + (effect["to"] - value) * f
    if "delta" in effect:
        return value + effect["delta"] * f
    if "multiplier" in effect:
        return value * (1 + (effect["multiplier"] - 1) * f)
    if "rate_per_min" in effect:
        return value + effect["rate_per_min"] * elapsed / 60 * f
    return value


METRIC_ALIASES = {"hr_rest": "hr"}


class ScenarioEngine:
    def __init__(self, specs: dict[str, dict]):
        self.specs = specs
        self.active: list[ActiveScenario] = []

    def start(self, scenario_id: str, target: str | None, t: float) -> ActiveScenario:
        spec = self.specs[scenario_id]
        sc = ActiveScenario(scenario_id, spec, target, t)
        self.active.append(sc)
        return sc

    def clear(self) -> None:
        self.active.clear()

    def _for(self, kind: str, target: str | None = None):
        for sc in self.active:
            if sc.kind == kind and (target is None or sc.target == target):
                yield sc

    def apply_vitals(self, astro_id: str, module_id: str, v: dict, t: float) -> dict:
        v = dict(v)
        for sc in self.active:
            if sc.kind == "astronaut" and sc.target == astro_id:
                effects = sc.spec.get("effects", [])
            elif sc.kind == "module" and sc.target == module_id:
                effects = [e for e in sc.spec.get("effects", []) if e.get("applies_to") == "crew_in_module"]
            else:
                continue
            for e in effects:
                metric = METRIC_ALIASES.get(e.get("metric"), e.get("metric"))
                if metric in v and "pattern" not in e:
                    v[metric] = _apply(v[metric], e, sc.effect_factor(e, t), t - sc.start)
        return v

    def apply_env(self, module_id: str, env: dict, t: float) -> dict:
        env = dict(env)
        for sc in self.active:
            if not (sc.kind == "all" or (sc.kind == "module" and sc.target == module_id)):
                continue
            for e in sc.spec.get("effects", []):
                metric = e.get("metric")
                if metric not in env or e.get("applies_to") == "crew_in_module":
                    continue
                eff = dict(e)
                rec = sc.spec.get("recovery", {})
                if "multiplier" in eff and rec.get("in_module") == module_id:
                    eff["multiplier"] = rec.get("multiplier", 1)
                env[metric] = _apply(env[metric], eff, sc.effect_factor(e, t), t - sc.start)
        return env

    def link_down(self) -> bool:
        return any(
            e.get("link_up") is False and sc.recovery_start is None
            for sc in self._for("link")
            for e in sc.spec.get("effects", [])
        )

    def sensor_garbage(self, astro_id: str) -> list[str]:
        metrics = []
        for sc in self._for("astronaut", astro_id):
            if sc.recovery_start is None:
                metrics += [e["metric"] for e in sc.spec.get("effects", []) if e.get("pattern") == "garbage"]
        return metrics

    def override(self, astro_id: str, metric: str):
        """Значение «to» для дневных метрик (сон, опросник) от активного сценария."""
        for sc in self._for("astronaut", astro_id):
            for e in sc.spec.get("effects", []):
                if e.get("metric") == metric and "to" in e and sc.recovery_start is None:
                    return e["to"]
        return None

    def recover(self, astro_id: str | None, module_id: str | None, t: float) -> None:
        """Протокол выполнен — сценарии, которые этого ждут, начинают восстановление."""
        for sc in self.active:
            hit = (sc.kind == "astronaut" and sc.target == astro_id) or (
                sc.kind == "module" and sc.target == module_id
            )
            if hit and sc.recovery_start is None:
                sc.recovery_start = t

    def tick(self, t: float) -> None:
        for sc in list(self.active):
            if sc.recovery_start is None and not sc.waits_for_protocol and t - sc.start >= sc.duration:
                sc.recovery_start = t
            if sc.recovery_start is not None and t - sc.recovery_start >= sc.recovery_s:
                self.active.remove(sc)
