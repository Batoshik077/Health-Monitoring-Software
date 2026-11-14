"""Движок тревог: удержание условия, дедупликация по группе, эскалация, жизненный цикл.

active → acknowledged → resolved
Тревога не закрывается сама: показатель может вернуться в норму (condition_active = False),
но закрывает её человек или успешная перепроверка протокола.
"""
from __future__ import annotations

import itertools
from dataclasses import asdict, dataclass, field

from app.alerts.rules import SEVERITY_ORDER, Rule

ESCALATE_UNACKED_CRITICAL_S = 30
VITAL_GROUPS = {"spo2", "hr", "rr", "sbp", "temp"}
# общий балл не дублирует тревогу по конкретному показателю
SUPPRESSED_BY = {"news2": VITAL_GROUPS, "rr": {"spo2"}, "hr": {"spo2"}}  # одышка и тахикардия при гипоксии — часть её картины


@dataclass
class Alert:
    id: str
    group: str
    rule: str
    severity: str
    subject_type: str  # astronaut | module
    subject_id: str
    subject_name: str
    message: str
    created_at: float
    updated_at: float
    protocol_id: str | None = None
    status: str = "active"
    condition_active: bool = True
    acknowledged_by: str | None = None
    acknowledged_at: float | None = None
    resolved_at: float | None = None
    resolution: str | None = None
    escalated_to: str | None = None
    protocol_run_id: str | None = None
    history: list = field(default_factory=list)

    @property
    def open(self) -> bool:
        return self.status != "resolved"

    def to_dict(self) -> dict:
        return asdict(self)


class AlertEngine:
    def __init__(self, rules: list[Rule], rule_to_protocol: dict[str, str]):
        self.rules = rules
        self.rule_to_protocol = rule_to_protocol
        self.alerts: dict[str, Alert] = {}
        self._first_true: dict[tuple[str, str], float] = {}
        self._ids = itertools.count(1)
        self.events: list[tuple[str, Alert]] = []  # (created|updated|escalated, alert) — забирает Mission

    def open_alert(self, group: str, subject_id: str) -> Alert | None:
        for a in self.alerts.values():
            if a.open and a.group == group and a.subject_id == subject_id:
                return a
        return None

    def evaluate(self, subjects: dict[str, list], th: dict, t: float) -> None:
        """subjects = {'astronaut': [...], 'module': [...]}; у каждого есть .id и .name."""
        firing: dict[tuple[str, str], tuple[Rule, str, object]] = {}
        for rule in self.rules:
            for s in subjects.get(rule.scope, []):
                key = (rule.id, s.id)
                msg = rule.check(s, th)
                if not msg:
                    self._first_true.pop(key, None)
                    continue
                since = self._first_true.setdefault(key, t)
                if t - since < rule.sustain_s:
                    continue
                gkey = (rule.group, s.id)
                best = firing.get(gkey)
                if best is None or SEVERITY_ORDER[rule.severity] > SEVERITY_ORDER[best[0].severity]:
                    firing[gkey] = (rule, msg, s)

        # обновляем или создаём тревоги
        for (group, sid), (rule, msg, s) in firing.items():
            alert = self.open_alert(group, sid)
            if alert is None and self._suppressed(group, sid, firing):
                continue
            if alert is None:
                alert = Alert(
                    id=f"al_{next(self._ids)}", group=group, rule=rule.id, severity=rule.severity,
                    subject_type=rule.scope, subject_id=sid, subject_name=s.name, message=msg,
                    created_at=t, updated_at=t, protocol_id=self.rule_to_protocol.get(rule.id),
                )
                alert.history.append({"t": t, "event": "created", "severity": rule.severity})
                self.alerts[alert.id] = alert
                self.events.append(("created", alert))
                continue
            changed = not alert.condition_active
            alert.condition_active = True
            if SEVERITY_ORDER[rule.severity] > SEVERITY_ORDER[alert.severity]:
                alert.severity, alert.rule = rule.severity, rule.id
                alert.protocol_id = alert.protocol_id or self.rule_to_protocol.get(rule.id)
                alert.history.append({"t": t, "event": "severity_up", "severity": rule.severity})
                changed = True
            if msg != alert.message and SEVERITY_ORDER[rule.severity] >= SEVERITY_ORDER[alert.severity]:
                alert.message = msg  # текст не «понижаем» вместе с уровнем
            alert.updated_at = t
            if changed:
                self.events.append(("updated", alert))

        # тревоги, у которых условие больше не выполняется
        for alert in self.alerts.values():
            if alert.open and (alert.group, alert.subject_id) not in firing and alert.condition_active:
                if not self._group_pending(alert):
                    alert.condition_active = False
                    alert.updated_at = t
                    alert.history.append({"t": t, "event": "condition_cleared"})
                    self.events.append(("updated", alert))

        # эскалация: критическая тревога без подтверждения
        for alert in self.alerts.values():
            if (alert.status == "active" and alert.severity == "critical" and not alert.escalated_to
                    and t - alert.created_at >= ESCALATE_UNACKED_CRITICAL_S):
                self.escalate(alert, "commander", t, "не подтверждена 30 с")

    def _suppressed(self, group: str, sid: str, firing: dict) -> bool:
        blockers = SUPPRESSED_BY.get(group, set())
        return any(g in blockers and s == sid for g, s in firing) or any(
            a.open and a.group in blockers and a.subject_id == sid for a in self.alerts.values())

    def _group_pending(self, alert: Alert) -> bool:
        """Условие ещё выполняется, просто не набрало время удержания — не считаем, что всё прошло."""
        return any(
            key[1] == alert.subject_id and r.group == alert.group
            for key in self._first_true
            for r in self.rules if r.id == key[0]
        )

    def group_firing(self, group: str, subject_id: str) -> bool:
        return any(
            r.group == group and (r.id, subject_id) in self._first_true for r in self.rules
        )

    def escalate(self, alert: Alert, to: str, t: float, reason: str) -> None:
        alert.escalated_to = to
        alert.updated_at = t
        alert.history.append({"t": t, "event": "escalated", "to": to, "reason": reason})
        self.events.append(("updated", alert))

    def acknowledge(self, alert_id: str, who: str, t: float) -> Alert:
        a = self.alerts[alert_id]
        if a.status == "active":
            a.status, a.acknowledged_by, a.acknowledged_at, a.updated_at = "acknowledged", who, t, t
            a.history.append({"t": t, "event": "acknowledged", "by": who})
            self.events.append(("updated", a))
        return a

    def resolve(self, alert_id: str, t: float, resolution: str) -> Alert:
        a = self.alerts[alert_id]
        if a.open:
            a.status, a.resolved_at, a.resolution, a.updated_at = "resolved", t, resolution, t
            a.history.append({"t": t, "event": "resolved", "resolution": resolution})
            # условие снова должно продержаться sustain_s, прежде чем появится новая тревога
            for r in self.rules:
                if r.group == a.group:
                    self._first_true.pop((r.id, a.subject_id), None)
            self.events.append(("updated", a))
        return a
