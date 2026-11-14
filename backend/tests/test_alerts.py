from tests.conftest import run


def open_rules(m, subject=None):
    return {a.rule for a in m.alerts.alerts.values() if a.open and (subject is None or a.subject_id == subject)}


def test_quiet_day_has_no_alerts(mission):
    run(mission, 86400, step=10)
    assert open_rules(mission) == set()


def test_alert_waits_for_sustain(mission):
    mission.start_scenario("hypoxia", "a3")
    run(mission, 150, step=1)  # SpO₂ ещё не упал ниже 88 надолго
    assert "spo2_critical" not in open_rules(mission, "a3")
    run(mission, 200, step=1)
    assert "spo2_critical" in open_rules(mission, "a3")


def test_one_alert_per_group(mission):
    mission.start_scenario("hypoxia", "a3")
    run(mission, 600, step=1)
    spo2 = [a for a in mission.alerts.alerts.values() if a.group == "spo2" and a.subject_id == "a3"]
    assert len(spo2) == 1 and spo2[0].severity == "critical"
    assert "news2_warning" not in open_rules(mission, "a3")  # общий балл не дублирует


def test_unacked_critical_escalates(mission):
    mission.start_scenario("hypoxia", "a3")
    run(mission, 600, step=1)
    alert = next(a for a in mission.alerts.alerts.values() if a.group == "spo2")
    assert alert.escalated_to == "commander"


def test_protocol_recovers_and_resolves(mission):
    mission.start_scenario("hypoxia", "a3")
    run(mission, 400, step=1)
    alert = next(a for a in mission.alerts.alerts.values() if a.group == "spo2")
    run_ = mission.guidance.runs[alert.protocol_run_id]
    for n in range(len(run_.steps)):
        mission.mark_step(run_.id, n, True)
    assert run_.status == "rechecking"
    run(mission, run_.recheck_after_s + 10, step=1)
    assert run_.status == "improved"
    assert alert.status == "resolved"
    assert mission.astronauts["a3"].vitals["spo2"] >= 94


def test_every_rule_has_a_protocol(cfg):
    from app.alerts.rules import build_rules
    missing = [r.id for r in build_rules(cfg.thresholds) if r.id not in cfg.rule_to_protocol
               and r.id not in ("rr_extreme", "sbp_extreme", "hypothermia")]
    assert missing == []


def test_every_scenario_triggers_expected_alerts(cfg):
    from app.state import Mission
    for sid, spec in cfg.scenarios.items():
        if not spec.get("expected_alerts"):
            continue
        m = Mission(cfg, seed=2)
        m.start_scenario(sid, None)
        run(m, 3600, step=5)
        got = {a.rule for a in m.alerts.alerts.values()}
        assert set(spec["expected_alerts"]) <= got, (sid, got)
