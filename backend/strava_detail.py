"""Strava 응답 → 화면용 dict (활동 상세, 프로필·기어·누적, 세그먼트) 와 라이브 기록 → GPX.

backend/strava.py 가 Strava와 '통신'을 맡고, 이 모듈은 받은 값을 '정리'만 한다.
그래서 여기 함수들은 네트워크 없이 테스트할 수 있다.
"""
from datetime import datetime, timezone
from xml.sax.saxutils import escape

from backend.strava import STEP_SPORTS, SPORT_MAP, kmh

MAX_STREAM_POINTS = 400        # 그래프·지도에 충분하고 응답은 가볍게
STREAM_KEYS = "time,distance,altitude,heartrate,velocity_smooth,cadence,watts,grade_smooth,latlng"

# 라이브 기록 종목 → Strava 업로드 activity_type
UPLOAD_TYPES = {"러닝": "run", "바이크": "ride", "하이킹": "hike", "걷기": "walk", "수영": "swim"}


def _km(meters):
    return None if meters is None else round(meters / 1000, 2)


def _int(value):
    return None if value is None else round(value)


def _sport(activity):
    return SPORT_MAP.get(activity.get("sport_type") or activity.get("type"), "기타")


# ------------------------------------------------------------------
# 활동 상세
# ------------------------------------------------------------------
def _pace(seconds, meters):
    """1km당 초. 거리가 거의 없으면 None"""
    return round(seconds / (meters / 1000)) if meters and meters > 10 else None


def _splits(activity):
    result = []
    for s in activity.get("splits_metric") or []:
        moving = s.get("moving_time") or s.get("elapsed_time")
        result.append({
            "index": s.get("split"),
            "distance_km": _km(s.get("distance")),
            "elapsed_sec": s.get("elapsed_time"),
            "moving_sec": s.get("moving_time"),
            "pace_sec_per_km": _pace(moving, s.get("distance")),
            "speed_kmh": kmh(s.get("average_speed")),
            "elevation_diff_m": s.get("elevation_difference"),
            "avg_hr": _int(s.get("average_heartrate")),
        })
    return result


def _laps(activity, cadence_factor):
    return [{
        "index": lap.get("lap_index"),
        "name": lap.get("name"),
        "distance_km": _km(lap.get("distance")),
        "elapsed_sec": lap.get("elapsed_time"),
        "moving_sec": lap.get("moving_time"),
        "speed_kmh": kmh(lap.get("average_speed")),
        "avg_hr": _int(lap.get("average_heartrate")),
        "max_hr": _int(lap.get("max_heartrate")),
        "avg_cad": None if lap.get("average_cadence") is None
        else round(lap["average_cadence"] * cadence_factor),
        "avg_watts": _int(lap.get("average_watts")),
    } for lap in activity.get("laps") or []]


def _segments(activity):
    return [{
        "id": (e.get("segment") or {}).get("id"),
        "name": e.get("name") or (e.get("segment") or {}).get("name"),
        "distance_km": _km(e.get("distance")),
        "elapsed_sec": e.get("elapsed_time"),
        "moving_sec": e.get("moving_time"),
        "avg_grade": (e.get("segment") or {}).get("average_grade"),
        "pr_rank": e.get("pr_rank"),
        "kom_rank": e.get("kom_rank"),
        "avg_hr": _int(e.get("average_heartrate")),
        "avg_watts": _int(e.get("average_watts")),
    } for e in activity.get("segment_efforts") or []]


def downsample(streams, limit=MAX_STREAM_POINTS):
    """모든 stream에서 같은 위치를 골라 길이를 limit 이하로 줄인다 (처음과 끝은 꼭 남김)."""
    length = max((len(s.get("data") or []) for s in streams.values()), default=0)
    if length == 0:
        return [], 0
    if length <= limit:
        return list(range(length)), length
    step = (length - 1) / (limit - 1)
    return sorted({round(i * step) for i in range(limit)}), length


def streams_view(streams, sport):
    """Strava streams(key_by_type) → 같은 길이의 배열들. 없는 항목은 None"""
    if not streams:
        return None
    picks, length = downsample(streams)
    if not picks:
        return None

    def pick(key, convert=lambda v: v):
        data = (streams.get(key) or {}).get("data")
        if not data or len(data) != length:
            return None
        return [None if data[i] is None else convert(data[i]) for i in picks]

    cadence_factor = 2 if sport in STEP_SPORTS else 1
    return {
        "time_sec": pick("time"),
        "distance_km": pick("distance", lambda m: round(m / 1000, 3)),
        "altitude_m": pick("altitude", lambda v: round(v, 1)),
        "heartrate": pick("heartrate", round),
        "speed_kmh": pick("velocity_smooth", lambda v: round(v * 3.6, 1)),
        "cadence": pick("cadence", lambda v: round(v * cadence_factor)),
        "watts": pick("watts", round),
        "grade": pick("grade_smooth", lambda v: round(v, 1)),
        "latlng": pick("latlng", lambda p: [round(p[0], 5), round(p[1], 5)]),
    }


def activity_view(activity, streams=None):
    """Strava 상세 활동 → 화면용 dict (docs/API.md '활동 상세')"""
    sport = _sport(activity)
    gear = activity.get("gear")
    return {
        "activity_id": activity["id"],
        "url": f"https://www.strava.com/activities/{activity['id']}",
        "description": activity.get("description") or "",
        "device_name": activity.get("device_name"),
        "gear": {"id": gear.get("id"), "name": gear.get("name"),
                 "distance_km": _km(gear.get("distance"))} if gear else None,
        "average_speed_kmh": kmh(activity.get("average_speed")),
        "max_speed_kmh": kmh(activity.get("max_speed")),
        "average_watts": _int(activity.get("average_watts")),
        "max_watts": _int(activity.get("max_watts")),
        "weighted_watts": _int(activity.get("weighted_average_watts")),
        "kilojoules": _int(activity.get("kilojoules")),
        "calories": _int(activity.get("calories")),
        "suffer_score": _int(activity.get("suffer_score")),
        "elev_high": activity.get("elev_high"),
        "elev_low": activity.get("elev_low"),
        "kudos_count": activity.get("kudos_count"),
        "comment_count": activity.get("comment_count"),
        "achievement_count": activity.get("achievement_count"),
        "pr_count": activity.get("pr_count"),
        "photo_count": activity.get("total_photo_count", activity.get("photo_count")),
        "polyline": (activity.get("map") or {}).get("polyline")
        or (activity.get("map") or {}).get("summary_polyline") or None,
        "splits": _splits(activity),
        "laps": _laps(activity, 2 if sport in STEP_SPORTS else 1),
        "segments": _segments(activity),
        "streams": streams_view(streams, sport),
    }


# ------------------------------------------------------------------
# 프로필 · 기어 · 누적
# ------------------------------------------------------------------
def _gear_list(items):
    return [{"id": g.get("id"), "name": g.get("name"), "distance_km": _km(g.get("distance")),
             "primary": bool(g.get("primary"))} for g in items or []]


def _totals(t):
    t = t or {}
    return {"count": t.get("count", 0), "distance_km": _km(t.get("distance", 0)),
            "moving_sec": t.get("moving_time", 0), "elevation_m": round(t.get("elevation_gain") or 0)}


def profile_view(athlete, stats):
    name = f"{athlete.get('firstname', '')} {athlete.get('lastname', '')}".strip()
    return {
        "athlete": {
            "id": athlete.get("id"),
            "name": name,
            "profile_url": athlete.get("profile") if str(athlete.get("profile", "")).startswith("http") else None,
            "city": athlete.get("city"),
            "country": athlete.get("country"),
            "premium": bool(athlete.get("premium") or athlete.get("summit")),
            "ftp": athlete.get("ftp"),
            "weight": athlete.get("weight"),
            "follower_count": athlete.get("follower_count"),
            "friend_count": athlete.get("friend_count"),
        },
        "gear": {"bikes": _gear_list(athlete.get("bikes")), "shoes": _gear_list(athlete.get("shoes"))},
        "totals": {
            "recent_run": _totals(stats.get("recent_run_totals")),
            "recent_ride": _totals(stats.get("recent_ride_totals")),
            "ytd_run": _totals(stats.get("ytd_run_totals")),
            "ytd_ride": _totals(stats.get("ytd_ride_totals")),
            "all_run": _totals(stats.get("all_run_totals")),
            "all_ride": _totals(stats.get("all_ride_totals")),
        },
    }


# ------------------------------------------------------------------
# 세그먼트
# ------------------------------------------------------------------
def segment_view(seg):
    pr = seg.get("athlete_pr_effort") or {}
    pr_date = pr.get("start_date_local") or pr.get("pr_date")
    return {
        "id": seg.get("id"),
        "name": seg.get("name"),
        "activity_type": seg.get("activity_type"),
        "distance_km": _km(seg.get("distance")),
        "avg_grade": seg.get("average_grade"),
        "max_grade": seg.get("maximum_grade"),
        "elev_high": seg.get("elevation_high"),
        "elev_low": seg.get("elevation_low"),
        "climb_category": seg.get("climb_category"),
        "city": seg.get("city"),
        "pr_elapsed_sec": pr.get("pr_elapsed_time") or pr.get("elapsed_time"),
        "pr_date": pr_date[:10] if pr_date else None,
        "effort_count": pr.get("effort_count"),
        "url": f"https://www.strava.com/segments/{seg.get('id')}",
    }


# ------------------------------------------------------------------
# 라이브 기록 → GPX
# ------------------------------------------------------------------
def _iso(value):
    """datetime 또는 '2026-10-21T06:00:00.123Z' → GPX용 UTC 문자열 (시간대 없으면 UTC로 본다)"""
    if isinstance(value, str):
        value = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if value.tzinfo is not None:
        value = value.astimezone(timezone.utc)
    return value.strftime("%Y-%m-%dT%H:%M:%SZ")


def build_gpx(name, points):
    """points: [{lat, lng, time, ele?}] (시간순) → GPX 1.1 문자열"""
    rows = []
    for p in points:
        ele = f"<ele>{float(p['ele']):.1f}</ele>" if p.get("ele") is not None else ""
        rows.append(f'<trkpt lat="{float(p["lat"]):.6f}" lon="{float(p["lng"]):.6f}">'
                    f"{ele}<time>{_iso(p['time'])}</time></trkpt>")
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<gpx version="1.1" creator="PACEHUB" xmlns="http://www.topografix.com/GPX/1/1">\n'
            f"<trk><name>{escape(name)}</name><trkseg>\n" + "\n".join(rows) + "\n</trkseg></trk>\n</gpx>\n")
