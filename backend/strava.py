"""Strava 연동: OAuth 연결, 토큰 갱신, 활동 가져오기, 활동 → Workout 변환."""
import hashlib
import hmac
import re
import time
from datetime import datetime, timezone
from urllib.parse import urlencode

import httpx

from backend import config
from backend.workout import Workout

AUTHORIZE_URL = "https://www.strava.com/oauth/authorize"
TOKEN_URL = "https://www.strava.com/oauth/token"
API_URL = "https://www.strava.com/api/v3"
SCOPE = "read,activity:read_all,activity:write"     # write: 라이브 기록을 Strava에 올릴 때
WRITE_SCOPE = "activity:write"

PER_PAGE = 100
MAX_PAGES = 5            # 한 번 동기화에 최대 500개. 더 있으면 다시 누르면 이어서 가져온다.
STATE_TTL_SEC = 600      # 연결 버튼을 누르고 10분 안에 돌아와야 한다

# Strava sport_type → 우리 종목
SPORT_MAP = {
    "Run": "러닝", "TrailRun": "러닝", "VirtualRun": "러닝",
    "Ride": "바이크", "VirtualRide": "바이크", "GravelRide": "바이크",
    "MountainBikeRide": "바이크", "EBikeRide": "바이크", "EMountainBikeRide": "바이크",
    "Velomobile": "바이크", "Handcycle": "바이크",
    "Hike": "하이킹",
    "Walk": "걷기",
    "Swim": "수영",
}
# Strava는 러닝 케이던스를 '한 발 기준'으로 준다 → 두 발 기준 spm으로 바꾸려면 ×2
STEP_SPORTS = {"러닝", "하이킹", "걷기"}


# 오픈라이더 등이 이름 앞에 붙이는 제어문자(\u0000 등)는 Postgres text에 못 넣는다
CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")


def clean_text(text):
    return CONTROL_CHARS.sub("", text or "").strip()


class StravaError(Exception):
    def __init__(self, message, status=None):
        super().__init__(message)
        self.status = status          # Strava HTTP 상태 (404면 '없는 활동')


ACTIVITY_ID = re.compile(r"\d{1,20}")


def activity_id(value):
    """Strava 활동 id는 숫자만. 경로 조작(../athlete 등)을 막는다."""
    text = str(value or "")
    if not ACTIVITY_ID.fullmatch(text):
        raise StravaError("Strava 활동 id가 올바르지 않습니다.", 400)
    return text


# ------------------------------------------------------------------
# OAuth
# ------------------------------------------------------------------
def _sign(text):
    return hmac.new(config.STRAVA_CLIENT_SECRET.encode(), text.encode(), hashlib.sha256).hexdigest()


def make_state(user_id, now=None):
    """'이 연결 요청은 이 사용자가 시작했다'는 서명값. 다른 사람의 Strava가 붙는 것을 막는다."""
    expires = int(now if now is not None else time.time()) + STATE_TTL_SEC
    payload = f"{user_id}.{expires}"
    return f"{payload}.{_sign(payload)}"


def check_state(state, user_id, now=None):
    try:
        state_user, expires, signature = state.rsplit(".", 2)
    except (AttributeError, ValueError):
        return False
    if not hmac.compare_digest(signature, _sign(f"{state_user}.{expires}")):
        return False
    if state_user != user_id:
        return False
    return int(expires) >= int(now if now is not None else time.time())


def authorize_url(redirect_uri, user_id):
    query = urlencode({
        "client_id": config.STRAVA_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": redirect_uri,
        "approval_prompt": "auto",
        "scope": SCOPE,
        "state": make_state(user_id),
    })
    return f"{AUTHORIZE_URL}?{query}"


def _token_request(data):
    res = httpx.post(TOKEN_URL, timeout=15, data={
        "client_id": config.STRAVA_CLIENT_ID,
        "client_secret": config.STRAVA_CLIENT_SECRET,
        **data,
    })
    if res.status_code != 200:
        # 응답 원문은 서버 로그에만 남기고 사용자에게는 상태 코드만 보여준다
        print(f"strava token error {res.status_code}: {res.text[:300]}")
        raise StravaError(f"Strava 인증 실패 ({res.status_code}). 다시 연결해 주세요.", res.status_code)
    return res.json()


def _epoch_to_iso(epoch):
    return datetime.fromtimestamp(epoch, tz=timezone.utc).isoformat()


def exchange_code(code):
    """연결 직후 받은 code를 토큰으로 바꾼다. strava_connections 한 행(dict)을 돌려준다."""
    data = _token_request({"code": code, "grant_type": "authorization_code"})
    athlete = data.get("athlete") or {}
    name = f"{athlete.get('firstname', '')} {athlete.get('lastname', '')}".strip()
    return {
        "athlete_id": athlete["id"],
        "athlete_name": name,
        "access_token": data["access_token"],
        "refresh_token": data["refresh_token"],
        "expires_at": _epoch_to_iso(data["expires_at"]),
    }


def refresh_if_needed(connection, now=None):
    """토큰이 만료(1분 전 포함)됐으면 새 토큰 dict를, 아니면 None을 돌려준다."""
    now = now if now is not None else time.time()
    expires = datetime.fromisoformat(connection["expires_at"]).timestamp()
    if expires - 60 > now:
        return None
    data = _token_request({"refresh_token": connection["refresh_token"], "grant_type": "refresh_token"})
    return {
        "access_token": data["access_token"],
        "refresh_token": data["refresh_token"],
        "expires_at": _epoch_to_iso(data["expires_at"]),
    }


# ------------------------------------------------------------------
# 활동 가져오기
# ------------------------------------------------------------------
def _check(res, what):
    status = res.status_code
    if status == 401:
        raise StravaError("Strava 권한이 없습니다. 연결을 해제한 뒤 다시 연결해 주세요.", status)
    if status == 403:
        raise StravaError(f"Strava가 {what} 권한을 허용하지 않았습니다. 연결을 해제한 뒤 다시 연결해 주세요.", status)
    if status == 404:
        raise StravaError(f"Strava에서 {what}을(를) 찾을 수 없습니다.", status)
    if status == 429:
        raise StravaError("Strava 요청 한도에 걸렸습니다. 15분 뒤 다시 시도해 주세요.", status)
    if status >= 400:
        print(f"strava {what} error {status}: {res.text[:300]}")
        raise StravaError(f"Strava {what} 처리 실패 ({status})", status)
    return res.json()


def api_get(access_token, path, what, **params):
    """Strava API GET 한 번. 오류는 StravaError로 바꾼다."""
    res = httpx.get(f"{API_URL}{path}", timeout=20, params=params,
                    headers={"Authorization": f"Bearer {access_token}"})
    return _check(res, what)


# 우리 종목 → Strava sport_type (수동 활동 만들기용)
SPORT_TYPES = {"러닝": "Run", "바이크": "Ride", "하이킹": "Hike", "걷기": "Walk", "수영": "Swim", "기타": "Workout"}


def create_activity(access_token, workout, start_date_local):
    """GPS 없는 '수동 활동'을 Strava에 만든다 (activity:write 필요). 만들어진 활동 dict를 돌려준다."""
    res = httpx.post(f"{API_URL}/activities", timeout=20,
                     headers={"Authorization": f"Bearer {access_token}"},
                     data={
                         "name": workout.name or f"{workout.sport} 기록",
                         "sport_type": SPORT_TYPES.get(workout.sport, "Workout"),
                         "start_date_local": start_date_local,
                         "elapsed_time": workout.duration_sec,
                         "distance": round(workout.distance_km * 1000, 1),
                         "description": workout.memo or "",
                     })
    return _check(res, "활동 만들기")


def upload_gpx(access_token, gpx_text, name, description, activity_type):
    """GPX 파일을 Strava에 올린다. Strava가 처리하는 데 몇 초 걸려서 upload id를 돌려준다."""
    res = httpx.post(f"{API_URL}/uploads", timeout=30,
                     headers={"Authorization": f"Bearer {access_token}"},
                     data={"data_type": "gpx", "name": name, "description": description,
                           "activity_type": activity_type},
                     files={"file": ("activity.gpx", gpx_text.encode("utf-8"), "application/gpx+xml")})
    return _check(res, "업로드")


def fetch_activities(access_token, after_epoch):
    """after_epoch 이후 활동을 오래된 것부터 가져온다. (리스트, 더 남았는지)"""
    activities = []
    for page in range(1, MAX_PAGES + 1):
        res = httpx.get(f"{API_URL}/athlete/activities", timeout=20,
                        headers={"Authorization": f"Bearer {access_token}"},
                        params={"after": after_epoch, "per_page": PER_PAGE, "page": page})
        if res.status_code == 401:
            raise StravaError("Strava 권한이 없습니다. 연결을 해제한 뒤 다시 연결해 주세요.")
        if res.status_code == 429:
            raise StravaError("Strava 요청 한도에 걸렸습니다. 15분 뒤 다시 시도해 주세요.")
        if res.status_code != 200:
            raise StravaError(f"Strava 활동 조회 실패 ({res.status_code})")
        batch = res.json()
        activities.extend(batch)
        if len(batch) < PER_PAGE:
            return activities, False
    return activities, True


def _round_or_none(value, factor=1):
    if value is None:
        return None
    return round(value * factor)


def kmh(meters_per_sec):
    """m/s → km/h (소수 1자리)"""
    return None if meters_per_sec is None else round(meters_per_sec * 3.6, 1)


def to_workout(activity):
    """Strava 활동(dict) → Workout"""
    sport = SPORT_MAP.get(activity.get("sport_type") or activity.get("type"), "기타")
    duration = activity.get("moving_time") or activity.get("elapsed_time") or 1

    cadence_factor = 2 if sport in STEP_SPORTS else 1
    has_hr = activity.get("has_heartrate", activity.get("average_heartrate") is not None)

    return Workout(
        activity["start_date_local"][:10],
        sport,
        round((activity.get("distance") or 0) / 1000, 2),     # m → km
        duration,
        _round_or_none(activity.get("average_heartrate")) if has_hr else None,
        _round_or_none(activity.get("max_heartrate")) if has_hr else None,
        _round_or_none(activity.get("average_cadence"), cadence_factor),
        None,                                                   # 목록 API에는 최대 케이던스가 없다
        _round_or_none(activity.get("calories")),               # 목록 API에는 보통 없음 → None
        "",
        name=clean_text(activity.get("name")) or None,
        elevation_gain_m=activity.get("total_elevation_gain"),
        started_at=activity.get("start_date"),
        source="strava",
        external_id=str(activity["id"]),
        polyline=(activity.get("map") or {}).get("summary_polyline") or None,
        kudos_count=activity.get("kudos_count"),
        avg_watts=_round_or_none(activity.get("average_watts")),
        max_speed_kmh=kmh(activity.get("max_speed")),
        gear_id=activity.get("gear_id"),
    )
