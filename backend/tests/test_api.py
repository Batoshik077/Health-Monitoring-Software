from fastapi.testclient import TestClient


def test_api_smoke(monkeypatch, tmp_path):
    monkeypatch.setenv("ASTRO_DB", str(tmp_path / "t.db"))
    import importlib

    import app.settings
    importlib.reload(app.settings)
    import app.main
    importlib.reload(app.main)
    with TestClient(app.main.app) as c:
        assert len(c.get("/api/crew").json()) == 4
        me = c.get("/api/me/a3").json()
        assert set(me["systems"]) == {"cardio", "respiratory", "bone_muscle", "behavioral", "immune", "radiation"}
        assert c.post("/api/surveys", json={"astronaut_id": "a3", "mood": 7, "stress": 3, "fatigue": 4,
                                            "sleep_quality": 6}).status_code == 200
        assert c.get("/api/me/a3").json()["checked_in_today"] is True
        assert c.post("/api/director/scenario/hypoxia", json={"target": "a3"}).json()["target"] == "a3"
        assert c.post("/api/director/clock", json={"speed": 60}).json()["speed"] == 60
        assert c.post("/api/ground/messages", json={"text": "Как самочувствие?"}).json()["delivered_at"] is None
        with c.websocket_connect("/ws/onboard") as ws:
            assert ws.receive_json()["side"] == "onboard"
        with c.websocket_connect("/ws/ground") as ws:
            assert ws.receive_json()["side"] == "ground"
        assert c.get("/api/director/scenarios").status_code == 200
        assert c.post("/api/director/reset").json() == {"ok": True}
