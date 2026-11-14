"""Баллы NEWS2 по каждому параметру. Границы берутся из config/thresholds.yaml (vitals)."""
from __future__ import annotations

PARAM_KEYS = {"rr": "resp_rate", "spo2": "spo2", "sbp": "systolic_bp", "hr": "heart_rate", "temp": "temperature"}


def _ranges(value) -> list[tuple[float, float]]:
    """[a, b] или [[a, b], [c, d]] → список пар."""
    if value is None:
        return []
    if isinstance(value[0], (list, tuple)):
        return [tuple(r) for r in value]
    return [tuple(value)]


def _in(v: float, ranges: list[tuple[float, float]]) -> bool:
    return any(lo <= v <= hi for lo, hi in ranges)


def score_param(key: str, v: float | None, cfg: dict) -> int:
    if v is None:
        return 0
    if key == "spo2":
        if v >= cfg["normal_min"]:
            return 0
        if v >= cfg["info_min"]:
            return 1
        if v >= cfg["warning_min"]:
            return 2
        return 3
    if _in(v, _ranges(cfg.get("normal"))):
        return 0
    if _in(v, _ranges(cfg.get("info"))):
        return 1
    if _in(v, _ranges(cfg.get("warning"))):
        return 2
    if key == "temp":
        if "warning_high" in cfg and v >= cfg["warning_high"]:
            return 2
        if v <= cfg["critical_low"]:
            return 3
        # значения между полосами (например 38.05) относим к ближайшей верхней полосе
        return 1
    return 3


def score(vitals: dict, vitals_cfg: dict) -> tuple[int, dict[str, int]]:
    parts = {k: score_param(k, vitals.get(k), vitals_cfg[name]) for k, name in PARAM_KEYS.items()}
    return sum(parts.values()), parts


def level(total: int, parts: dict[str, int], levels: dict) -> str:
    """normal / info / warning / critical по правилам реагирования NEWS2."""
    if total >= levels["critical"]:
        return "critical"
    if total >= levels["warning"] or max(parts.values(), default=0) >= 3:
        return "warning"
    if total >= levels["info"]:
        return "info"
    return "normal"
