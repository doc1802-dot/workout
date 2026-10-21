from backend.stats import monthly_stats, period_stats, personal_records, total_stats
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


# ------------------------------------------------------------------
# 대시보드 기간/종목 통계
# ------------------------------------------------------------------
PERIOD = WORKOUTS + [Workout("2024-03-03", "바이크", 30.0, 90 * 60, calories=600)]


def test_period_all_years_zero_filled():
    s = period_stats(PERIOD)
    assert s["unit"] == "year" and s["years"] == [2024, 2026]
    assert [b["key"] for b in s["buckets"]] == ["2024", "2025", "2026"]    # 기록 없는 2025도 0으로
    assert s["buckets"][1]["count"] == 0
    assert s["total"]["count"] == 6


def test_period_year_has_12_months():
    s = period_stats(PERIOD, year=2026)
    assert s["unit"] == "month" and len(s["buckets"]) == 12
    oct_ = s["buckets"][9]
    assert (oct_["key"], oct_["label"], oct_["count"]) == ("2026-10", "10월", 4)
    assert oct_["by_sport"] == {"러닝": 5.0, "바이크": 100.0, "기타": 0.0}
    assert s["total"]["count"] == 5                                    # 2024 기록은 빠짐


def test_period_month_days_and_sport_filter():
    s = period_stats(PERIOD, year=2026, month=10, sport="바이크")
    assert s["unit"] == "day" and len(s["buckets"]) == 31
    assert s["buckets"][11]["key"] == "2026-10-12" and s["buckets"][11]["distance_km"] == 40.0
    assert s["total"]["count"] == 2 and s["total"]["distance_km"] == 100.0
    # 종목 탭용 요약은 종목으로 거르지 않는다
    assert [x["sport"] for x in s["by_sport"]] == ["바이크", "기타", "러닝"]
    assert s["pr"]["best_run"] is None and s["pr"]["best_bike"]["date"] == "2026-10-12"


def test_period_empty():
    s = period_stats([])
    assert s["buckets"] == [] and s["years"] == [] and s["total"]["count"] == 0
