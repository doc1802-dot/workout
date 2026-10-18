from workout import Workout, from_row


def make(sport, distance, minutes):
    """테스트용 기록을 간단히 만드는 도우미"""
    return Workout("2026-10-01", sport, distance, minutes, 0, 0, 0, 0, 0, "")


def test_distance_is_number():
    w = make("러닝", "5.0", "30")
    assert w.distance == 5.0          # 문자열 "5.0"이 아니라 숫자 5.0


def test_bike_speed():
    w = make("바이크", "60.0", "200")
    assert round(w.speed(), 1) == 18.0


def test_run_pace_sec():
    w = make("러닝", "5.0", "30")
    assert w.pace_sec() == 30*60 / 5


def test_cadence_unit():
    assert make("바이크", "40", "120").cadence_unit() =="rpm"
    assert make("러닝", "5", "30").cadence_unit() == "spm"


def test_summary_run():
    w = make("러닝", "5.0", "27")
    assert w.summary() == "평균페이스: 5분 24초 /km"


def test_summary_bike():
    w = make("바이크", "40.0", "120")
    assert w.summary() == f"평균속도: 20.0 km/h"

def test_from_row():
    row = {"날짜": "2026-10-01", "종목": "러닝", "거리(km)": "5.0", "시간(분)": "30",
           "평균심박": "160", "최대심박": "180", "평균케이던스": "170",
           "최대케이던스": "180", "칼로리": "450", "메모": "태화강 런"}
    w = from_row(row)
    assert w.distance == 5.0
    assert w.avg_hr == 160
    assert w.memo == "태화강 런"


def test_to_row_round_trip():
    w = make("바이크", "40.0", "120")
    w2 = from_row(w.to_row())             # 객체 → 딕셔너리 → 다시 객체
    assert w2.distance == w.distance
    assert w2.minutes == w.minutes
    assert w2.summary() == w.summary()
