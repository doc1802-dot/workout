"""Strava MCP 활동 → Workout 변환.

Strava MCP(list_activities)는 Claude만 부를 수 있는 도구라 웹 서버가 직접 쓸 수 없다.
그래서 Claude가 MCP로 활동을 받아 이 모듈로 변환하고 DB에 넣는다. (scripts/strava_mcp_sync.py)
REST 동기화(backend/strava.py)와 source/external_id가 같으므로 어느 쪽으로 넣어도 중복되지 않는다.

MCP 형식은 REST와 다르다:
  - start_local (현지 시각, 시간대 없음) → 날짜만 쓰고 started_at은 비워 둔다
  - summary 안에 distance, moving_time, elevation_gain, avg_cadence, total_calories
  - 심박은 목록에 없고 get_activity_performance 결과(performance)에 있다
"""
from backend.strava import SPORT_MAP, STEP_SPORTS, _round_or_none, clean_text, kmh
from backend.workout import Workout

def to_workout(activity, performance=None):
    """MCP 활동(dict) → Workout. performance가 있으면 심박을 채운다."""
    summary = activity.get("summary") or {}
    sport = SPORT_MAP.get(activity.get("sport_type"), "기타")
    duration = summary.get("moving_time") or summary.get("elapsed_time") or 1
    cadence_factor = 2 if sport in STEP_SPORTS else 1

    perf = performance or {}
    has_hr = perf.get("has_heartrate", perf.get("average_heartrate") is not None)

    return Workout(
        activity["start_local"][:10],
        sport,
        round((summary.get("distance") or 0) / 1000, 2),          # m → km
        duration,
        _round_or_none(perf.get("average_heartrate")) if has_hr else None,
        _round_or_none(perf.get("max_heartrate")) if has_hr else None,
        _round_or_none(summary.get("avg_cadence"), cadence_factor),
        None,                                                       # 최대 케이던스는 MCP에도 없다
        _round_or_none(summary.get("total_calories") or perf.get("calories")),
        "",
        name=clean_text(activity.get("name")) or None,
        elevation_gain_m=summary.get("elevation_gain"),
        source="strava",
        external_id=str(activity["id"]),
        kudos_count=summary.get("kudos_count"),
        max_speed_kmh=kmh(summary.get("max_speed")),
        polyline=activity.get("polyline") or None,        # include_polyline=true 일 때만 있다
    )
