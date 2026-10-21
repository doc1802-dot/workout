from backend.stats import monthly_stats, personal_records, total_stats
from backend.workout import Workout

WORKOUTS = [
    Workout("2026-09-05", "러닝", 5.0, 33 * 60, calories=460),
    Workout("2026-10-01", "러닝", 5.0, 30 * 60, calories=450),
    Workout("2026-10-12", "바이크", 40.0, 120 * 60),          # 칼로리 모름(None)
    Workout("2026-10-13", "바이크", 60.0, 200 * 60, calories=950),
    Workout("2026-10-20", "기타", 0, 1800),                  # 거리 없는 운동
]


def test_total():
    t = total_stats(WORKOUTS)
    assert t["count"] == 5
    assert t["distance_km"] == 110.0
    assert t["calories"] == 1860
    assert t["by_sport"] == {"러닝": 10.0, "바이크": 100.0, "기타": 0.0}


def test_monthly_sorted():
    m = monthly_stats(WORKOUTS)
    assert [x["month"] for x in m] == ["2026-09", "2026-10"]
    assert m[1]["count"] == 4
    assert m[1]["by_sport"]["바이크"] == 100.0


def test_pr():
    pr = personal_records(WORKOUTS)
    assert pr["best_run"]["date"] == "2026-10-01"            # 30분이 33분보다 빠름
    assert pr["best_bike"]["date"] == "2026-10-12"           # 20km/h > 18km/h
    assert pr["longest"]["distance_km"] == 60.0


def test_pr_empty():
    assert personal_records([]) == {"best_run": None, "best_bike": None, "longest": None}
