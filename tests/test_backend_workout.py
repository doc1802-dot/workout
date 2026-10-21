from backend.workout import Workout, from_db


def make(sport, distance, minutes):
    """테스트용 기록 (cli/test_workout.py 와 같은 값으로 같은 결과가 나와야 한다)"""
    return Workout("2026-10-01", sport, distance, minutes * 60)


def test_summary_run_same_as_cli():
    assert make("러닝", 5.0, 27).summary() == "평균페이스: 5분 24초 /km"


def test_summary_bike_same_as_cli():
    assert make("바이크", 40.0, 120).summary() == "평균속도: 20.0 km/h"


def test_summary_without_distance():
    assert Workout("2026-10-01", "기타", 0, 1830).summary() == "시간: 30분 30초"


def test_cadence_unit():
    assert make("바이크", 40, 120).cadence_unit() == "rpm"
    assert make("러닝", 5, 30).cadence_unit() == "spm"


def test_db_round_trip_keeps_unknown_as_none():
    w = Workout("2026-10-15", "러닝", "3.92", 1800, 159, 183, None, None, None, "러닝머신")
    row = w.to_db()
    row["id"] = "abc"
    back = from_db(row)
    assert back.distance_km == 3.92
    assert back.avg_cad is None
    api = back.to_api()
    assert api["id"] == "abc"
    assert api["summary"] == "평균페이스: 7분 39초 /km"
