"""SQLite: то, что должно пережить перезапуск (тревоги, протоколы, опросники, журнал).

Живые показатели хранятся в памяти (кольцевые буферы в Mission).
"""
from __future__ import annotations

import json
import sqlite3

KEYED = ("alerts", "protocol_runs")
LOGS = ("surveys", "symptoms", "exercise_log", "medical_log", "messages")


class Store:
    def __init__(self, path: str = ":memory:"):
        self.conn = sqlite3.connect(path, check_same_thread=False)
        for table in KEYED:
            self.conn.execute(
                f"CREATE TABLE IF NOT EXISTS {table} (id TEXT PRIMARY KEY, sim_time REAL, data TEXT)")
        for table in LOGS:
            self.conn.execute(
                f"CREATE TABLE IF NOT EXISTS {table} (id INTEGER PRIMARY KEY AUTOINCREMENT, "
                f"astronaut_id TEXT, sim_time REAL, data TEXT)")
        self.conn.commit()

    def upsert(self, table: str, id: str, sim_time: float, data: dict) -> None:
        assert table in KEYED
        self.conn.execute(
            f"INSERT INTO {table} (id, sim_time, data) VALUES (?, ?, ?) "
            f"ON CONFLICT(id) DO UPDATE SET sim_time = excluded.sim_time, data = excluded.data",
            (id, sim_time, json.dumps(data, ensure_ascii=False)))
        self.conn.commit()

    def append(self, table: str, astronaut_id: str | None, sim_time: float, data: dict) -> None:
        assert table in LOGS
        self.conn.execute(f"INSERT INTO {table} (astronaut_id, sim_time, data) VALUES (?, ?, ?)",
                          (astronaut_id, sim_time, json.dumps(data, ensure_ascii=False)))
        self.conn.commit()

    def list(self, table: str, astronaut_id: str | None = None, limit: int = 100) -> list[dict]:
        if table in LOGS and astronaut_id:
            rows = self.conn.execute(
                f"SELECT sim_time, data FROM {table} WHERE astronaut_id = ? ORDER BY id DESC LIMIT ?",
                (astronaut_id, limit))
        else:
            rows = self.conn.execute(f"SELECT sim_time, data FROM {table} ORDER BY sim_time DESC LIMIT ?", (limit,))
        return [{"sim_time": t, **json.loads(d)} for t, d in rows]

    def clear(self) -> None:
        for table in KEYED + LOGS:
            self.conn.execute(f"DELETE FROM {table}")
        self.conn.commit()
