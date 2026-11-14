import json

from app.local_api import LocalApp


def call(app, method, url, body=None):
    r = json.loads(app.request(method, url, json.dumps(body) if body is not None else ""))
    return r["status"], r["body"]


def test_local_api_matches_server_flow():
    app = LocalApp()
    assert call(app, "GET", "/api/crew")[1][0]["id"] == "a1"
    assert call(app, "POST", "/api/director/scenario/hypoxia", {"target": "a3"})[1]["target"] == "a3"
    assert call(app, "POST", "/api/director/clock", {"speed": 10})[0] == 200
    for _ in range(40):
        app.tick(1.0)  # 40 с реального времени × 10 = 400 с миссии
    snap = json.loads(app.snapshots())
    alert = next(a for a in snap["onboard"]["alerts"] if a["group"] == "spo2")
    run_id = alert["protocol_run_id"]
    status, run = call(app, "POST", f"/api/protocol-runs/{run_id}/steps/0", {"done": True})
    assert status == 200 and run["steps_done"][0] is True
    assert call(app, "GET", "/api/crew/a3/history?minutes=5")[0] == 200
    assert call(app, "POST", "/api/surveys", {"astronaut_id": "a3", "mood": 7, "stress": 3, "fatigue": 4, "sleep_quality": 6})[0] == 200
    assert call(app, "POST", "/api/ground/messages", {"text": "Как самочувствие?"})[1]["delivered_at"] is None
    assert call(app, "POST", "/api/director/reset")[1] == {"ok": True}


def test_local_api_errors():
    app = LocalApp()
    assert call(app, "GET", "/api/me/zz")[0] == 404
    assert call(app, "POST", "/api/surveys", {"astronaut_id": "a1", "mood": 11, "stress": 1, "fatigue": 1, "sleep_quality": 1})[0] == 422
    assert call(app, "GET", "/api/nope")[0] == 404


def test_memory_store_and_json_config(tmp_path, monkeypatch):
    """Браузерный режим: без PyYAML и sqlite3."""
    import shutil

    import yaml

    import app.db as db
    import app.settings as settings
    from app.settings import CONFIG_DIR

    out = tmp_path / "config"
    for src in CONFIG_DIR.rglob("*.yaml"):
        dst = out / src.relative_to(CONFIG_DIR)
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_text(json.dumps(yaml.safe_load(src.read_text(encoding="utf-8")), ensure_ascii=False), encoding="utf-8")
    monkeypatch.setattr(settings, "yaml", None)
    cfg = settings.load_config(out)
    assert set(cfg.scenarios) and set(cfg.protocols)

    store = db.MemoryStore()
    store.upsert("alerts", "al_1", 1.0, {"x": 1})
    store.append("surveys", "a1", 2.0, {"mood": 7})
    assert store.list("alerts")[0]["x"] == 1 and store.list("surveys", "a1")[0]["mood"] == 7
    store.clear()
    assert store.list("alerts") == []
    shutil.rmtree(out)
