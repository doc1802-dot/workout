from calc import get_speed, get_pace_sec, calc_pace_or_speed

def test_bike_speed_60km_200min():
    record = {"종목": "바이크", "거리(km)": "60.0", "시간(분)": "200"}
    assert round(get_speed(record), 1) == 18.0

def test_run_pace_5km_30min():
    record = {"종목": "러닝", "거리(km)": "5.0", "시간(분)": "30"}
    assert get_pace_sec(record) == 360          # 1km당 몇 초?


def test_run_pace_text_5km_27min():
    record = {"종목": "러닝", "거리(km)": "5.0", "시간(분)": "27"}
    assert calc_pace_or_speed(record) == "평균페이스: 5분 24초 /km"


def test_run_pace_text_4_2km_25min():
    record = {"종목": "러닝", "거리(km)": "4.2", "시간(분)": "25"}
    assert calc_pace_or_speed(record) == "평균페이스: 5분 57초 /km"


def test_bike_speed_text():
    record = {"종목": "바이크", "거리(km)": "40.0", "시간(분)": "120"}
    assert calc_pace_or_speed(record) == "평균속도: 20.0 km/h"