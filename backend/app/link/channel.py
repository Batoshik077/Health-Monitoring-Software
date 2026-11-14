"""Outbox + Link Simulator: связь борт ↔ Земля.

- Очередь с приоритетами: P0 тревоги, P1 поминутные сводки, P2 подробные данные.
- Задержка в одну сторону (МКС 0 с, Луна 1.3 с, Марс 3–22 мин).
- Ограниченная пропускная способность: N пакетов в секунду времени миссии.
- Обрыв: то, что было «в полёте», теряется и отправляется повторно.
"""
from __future__ import annotations

import heapq
import itertools
from dataclasses import dataclass, field

PROFILE_DELAYS = {"iss": 0.0, "moon": 1.3, "mars": 720.0}


@dataclass(order=True)
class Packet:
    priority: int
    seq: int
    created_at: float = field(compare=False)
    payload: dict = field(compare=False)
    deliver_at: float = field(default=0.0, compare=False)


class Link:
    def __init__(self, profile: str = "mars", delay_s: float | None = None, bandwidth_pps: float = 2.0):
        self.profile = profile
        self.delay_s = PROFILE_DELAYS.get(profile, 0.0) if delay_s is None else float(delay_s)
        self.bandwidth_pps = bandwidth_pps
        self.manual_up = True
        self.forced_down = False  # сценарий blackout
        self.outbox: list[Packet] = []
        self.in_flight: list[Packet] = []
        self.uplink: list[Packet] = []  # Земля → борт
        self._seq = itertools.count()
        self._budget = 0.0
        self.delivered_count = 0
        self.retransmitted = 0

    @property
    def up(self) -> bool:
        return self.manual_up and not self.forced_down

    def send(self, priority: int, payload: dict, t: float) -> None:
        heapq.heappush(self.outbox, Packet(priority, next(self._seq), t, payload))

    def send_uplink(self, payload: dict, t: float) -> None:
        self.uplink.append(Packet(0, next(self._seq), t, payload, deliver_at=t + self.delay_s))

    def set_up(self, up: bool, t: float) -> None:
        was_up = self.up
        self.manual_up = up
        self._on_change(was_up, t)

    def set_forced_down(self, down: bool, t: float) -> None:
        was_up = self.up
        self.forced_down = down
        self._on_change(was_up, t)

    def _on_change(self, was_up: bool, t: float) -> None:
        if was_up and not self.up:
            # всё, что было в пути, потеряно — вернётся в очередь (повторная отправка)
            for p in self.in_flight:
                heapq.heappush(self.outbox, p)
                self.retransmitted += 1
            self.in_flight = []

    def step(self, t: float, dt: float) -> tuple[list[dict], list[dict]]:
        """Возвращает (доставлено на Землю, доставлено на борт)."""
        if not self.up:
            self._budget = 0.0
            return [], []
        self._budget = min(self._budget + self.bandwidth_pps * dt, self.bandwidth_pps * 60)
        while self.outbox and self._budget >= 1:
            p = heapq.heappop(self.outbox)
            p.deliver_at = t + self.delay_s
            self.in_flight.append(p)
            self._budget -= 1
        down = [p for p in self.in_flight if p.deliver_at <= t]
        self.in_flight = [p for p in self.in_flight if p.deliver_at > t]
        up = [p for p in self.uplink if p.deliver_at <= t]
        self.uplink = [p for p in self.uplink if p.deliver_at > t]
        self.delivered_count += len(down)
        for p in down:
            p.payload["_received_at"] = t
        return [p.payload for p in down], [p.payload for p in up]

    def status(self) -> dict:
        q = {"p0": 0, "p1": 0, "p2": 0}
        for p in self.outbox:
            q[f"p{p.priority}"] += 1
        return {
            "up": self.up,
            "manual_up": self.manual_up,
            "forced_down": self.forced_down,
            "profile": self.profile,
            "delay_s": self.delay_s,
            "bandwidth_pps": self.bandwidth_pps,
            "queue": q,
            "in_flight": len(self.in_flight),
            "uplink_in_flight": len(self.uplink),
            "delivered": self.delivered_count,
            "retransmitted": self.retransmitted,
        }
