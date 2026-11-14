from app.analytics import news2

NORMAL = {"rr": 16, "spo2": 98, "sbp": 120, "hr": 70, "temp": 36.8}


def test_normal_is_zero(cfg):
    total, parts = news2.score(NORMAL, cfg.thresholds["vitals"])
    assert total == 0 and set(parts.values()) == {0}


def test_bands_match_rcp_chart(cfg):
    v = cfg.thresholds["vitals"]
    cases = [
        ("spo2", 95, 1), ("spo2", 93, 2), ("spo2", 91, 3),
        ("hr", 45, 1), ("hr", 100, 1), ("hr", 120, 2), ("hr", 131, 3), ("hr", 40, 3),
        ("rr", 10, 1), ("rr", 22, 2), ("rr", 25, 3), ("rr", 8, 3),
        ("sbp", 105, 1), ("sbp", 95, 2), ("sbp", 90, 3), ("sbp", 220, 3),
        ("temp", 35.5, 1), ("temp", 38.5, 1), ("temp", 39.1, 2), ("temp", 35.0, 3),
    ]
    for key, value, expected in cases:
        name = news2.PARAM_KEYS[key]
        assert news2.score_param(key, value, v[name]) == expected, (key, value)


def test_levels(cfg):
    lv = cfg.thresholds["news2_levels"]
    assert news2.level(0, {"hr": 0}, lv) == "normal"
    assert news2.level(3, {"hr": 3}, lv) == "warning"  # один параметр на 3 балла
    assert news2.level(5, {"hr": 2}, lv) == "warning"
    assert news2.level(7, {"hr": 2}, lv) == "critical"
