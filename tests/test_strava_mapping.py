"""실제 Strava 활동(Strava MCP로 확인한 값)으로 변환 규칙을 검사한다."""
from datetime import datetime

from backend import config, strava

# 2026-10-01 Night Run: Strava 화면 기준 5.01km, 26:39, 케이던스 86.5(한 발)
NIGHT_RUN = {
    "id": 20406610343, "name": "Night Run", "sport_type": "Run", "type": "Run",
    "start_date": "2026-10-01T12:39:46Z", "start_date_local": "2026-10-01T21:39:46Z",
    "distance": 5011.8, "moving_time": 1599, "elapsed_time": 1834,
    "total_elevation_gain": 12, "average_cadence": 86.4827,
    "has_heartrate": True, "average_heartrate": 171.4, "max_heartrate": 188.0,
}

# 2026-09-19 영동 GF: 108.3km, 이동시간 17158초, Strava 평균속도 6.3109 m/s = 22.7 km/h
GRANFONDO = {
    "id": 20235096976, "name": "영동 GF", "sport_type": "Ride", "type": "Ride",
    "start_date": "2026-09-18T22:47:38Z", "start_date_local": "2026-09-19T07:47:38Z",
    "distance": 108282, "moving_time": 17158, "elapsed_time": 22865,
    "total_elevation_gain": 1552, "has_heartrate": False,
}


def test_run_mapping():
    w = strava.to_workout(NIGHT_RUN)
    assert w.date == "2026-10-01"                 # 현지 날짜 기준
    assert w.sport == "러닝"
    assert w.distance_km == 5.01
    assert w.duration_sec == 1599                 # 이동 시간
    assert w.avg_cad == 173                       # 한 발 86.5 → 두 발 173 spm
    assert w.avg_hr == 171 and w.max_hr == 188
    assert w.source == "strava" and w.external_id == "20406610343"
    assert w.summary() == "평균페이스: 5분 19초 /km"


def test_ride_mapping_matches_strava_speed():
    w = strava.to_workout(GRANFONDO)
    assert w.sport == "바이크"
    assert w.avg_hr is None                       # 심박 없는 활동
    assert w.summary() == "평균속도: 22.7 km/h"
    assert w.elevation_gain_m == 1552


def test_unknown_sport_is_etc():
    w = strava.to_workout({**NIGHT_RUN, "sport_type": "WeightTraining", "distance": 0})
    assert w.sport == "기타"
    assert w.summary() == "시간: 26분 39초"


def test_state_signed_for_one_user(monkeypatch):
    monkeypatch.setattr(config, "STRAVA_CLIENT_SECRET", "secret")
    state = strava.make_state("user-a", now=1000)
    assert strava.check_state(state, "user-a", now=1100)
    assert not strava.check_state(state, "user-b", now=1100)        # 다른 사용자
    assert not strava.check_state(state, "user-a", now=1000 + 601)  # 만료
    assert not strava.check_state(state.replace("user-a", "user-b"), "user-b", now=1100)  # 위조
    assert not strava.check_state("garbage", "user-a", now=1100)


def test_token_not_refreshed_when_valid():
    conn = {"expires_at": "2026-10-21T10:00:00+00:00", "refresh_token": "r"}
    expires = datetime.fromisoformat(conn["expires_at"]).timestamp()
    assert strava.refresh_if_needed(conn, now=expires - 3600) is None      # 만료 1시간 전


def test_control_chars_in_name_removed():
    # 오픈라이더 기록은 이름 앞에 \u0000 이 붙어 있어 그대로 넣으면 DB가 거부한다
    w = strava.to_workout({**GRANFONDO, "name": "\u0000\u0017신정5동 > 신정5동"})
    assert w.name == "신정5동 > 신정5동"
