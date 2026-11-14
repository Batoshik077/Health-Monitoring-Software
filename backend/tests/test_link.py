from app.link.channel import Link
from tests.conftest import run


def test_delay():
    link = Link("mars", delay_s=720, bandwidth_pps=10)
    link.send(0, {"kind": "x"}, 0)
    assert link.step(1, 1)[0] == []
    assert link.step(720, 719)[0] == []
    assert len(link.step(721, 1)[0]) == 1


def test_priority_after_blackout_and_no_loss():
    link = Link("iss", delay_s=0, bandwidth_pps=1)
    link.set_up(False, 0)
    for i in range(5):
        link.send(2, {"kind": "raw", "i": i}, i)
    link.send(0, {"kind": "alert"}, 6)
    link.set_up(True, 10)
    first, _ = link.step(11, 1)
    assert first[0]["kind"] == "alert"  # критичное уходит первым
    got = [*first]
    for t in range(12, 30):
        got += link.step(t, 1)[0]
    assert len(got) == 6  # ничего не потеряно


def test_in_flight_is_retransmitted_on_drop():
    link = Link("mars", delay_s=100, bandwidth_pps=10)
    link.send(0, {"kind": "alert"}, 0)
    link.step(1, 1)
    assert link.status()["in_flight"] == 1
    link.set_up(False, 2)
    assert link.status()["queue"]["p0"] == 1 and link.retransmitted == 1


def test_ground_sees_alert_only_after_delay(mission):
    mission.start_scenario("hypoxia", "a3")
    run(mission, 400, step=1)
    assert any(a.group == "spo2" for a in mission.alerts.alerts.values())
    assert not mission.ground.alerts  # Марс: 12 минут
    run(mission, 720, step=5)
    assert any(a["group"] == "spo2" for a in mission.ground.alerts.values())
