"""Strava MCP 활동 형식(실제 MCP 응답 값) 변환과 SQL 생성을 검사한다."""
from backend import strava_mcp
from scripts.strava_mcp_sync import build_sql, load_activities

# 2026-10-16 Morning Run: list_activities + get_activity_performance 실제 값
MORNING_RUN = {
    "id": "20602220840", "name": "Morning Run", "sport_type": "Run",
    "start_local": "2026-10-16T07:48:48",
    "summary": {"distance": 3924.89, "moving_time": 1800, "elapsed_time": 1800,
                "elevation_gain": 0, "total_calories": 415, "avg_cadence": 79.3025},
}
MORNING_RUN_PERF = {"has_heartrate": True, "average_heartrate": 158.646,
                    "max_heartrate": 183, "calories": 415}

# 2021-07-25 오픈라이더 기록: 이름 앞에 제어문자, 칼로리/케이던스 없음
OPENRIDER = {
    "id": "5681878777", "name": "\u0000\u0017신정5동 > 신정5동", "sport_type": "Ride",
    "start_local": "2021-07-25T09:14:20",
    "summary": {"distance": 36047.4, "moving_time": 5913, "elapsed_time": 6629,
                "elevation_gain": 78.1},
}

USER = "0e182d39-0bcd-4f77-8d68-1e17e6b9a5cd"


def test_run_with_performance():
    w = strava_mcp.to_workout(MORNING_RUN, MORNING_RUN_PERF)
    assert (w.date, w.sport, w.distance_km, w.duration_sec) == ("2026-10-16", "러닝", 3.92, 1800)
    assert w.avg_cad == 159                       # 한 발 79.3 → 두 발 159 spm
    assert (w.avg_hr, w.max_hr, w.calories) == (159, 183, 415)
    assert w.source == "strava" and w.external_id == "20602220840"


def test_without_performance_has_no_heartrate():
    w = strava_mcp.to_workout(MORNING_RUN)
    assert w.avg_hr is None and w.max_hr is None
    assert w.calories == 415                      # 칼로리는 목록에도 있다


def test_control_chars_removed_and_missing_values_none():
    w = strava_mcp.to_workout(OPENRIDER)
    assert w.name == "신정5동 > 신정5동"
    assert w.sport == "바이크" and w.distance_km == 36.05
    assert w.avg_cad is None and w.calories is None
    assert w.summary() == "평균속도: 21.9 km/h"


def test_unknown_sport_is_etc():
    w = strava_mcp.to_workout({**OPENRIDER, "sport_type": "WeightTraining",
                               "summary": {"distance": 0, "moving_time": 1200}})
    assert w.sport == "기타" and w.distance_km == 0


def test_build_sql_skips_duplicates_and_quotes(tmp_path):
    page = tmp_path / "page.json"
    quoted = {**OPENRIDER, "id": "1", "name": "It's mine"}
    page.write_text(
        '{"activities": [%s, %s, %s]}' % tuple(
            __import__("json").dumps(a) for a in (MORNING_RUN, MORNING_RUN, quoted)),
        encoding="utf-8")
    activities = load_activities([page])
    assert len(activities) == 2                   # 같은 id는 한 번만

    statements = build_sql(USER, activities, {"20602220840": MORNING_RUN_PERF}, batch=1)
    assert len(statements) == 2
    assert "on conflict (user_id, source, external_id) do nothing" in statements[0]
    assert "'It''s mine'" in statements[1]
    assert "158" not in statements[0] and ",159,183," in statements[0]
