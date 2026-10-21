"""운동기록 API (FastAPI).

cli/main.py 의 메뉴 번호가 여기서는 주소(URL)가 된다.
  1 기록 추가 → POST /api/workouts        2 기록 보기 → GET /api/workouts
  3 합계     → GET /api/stats/total      4 월별 합계 → GET /api/stats/monthly
  5 기록 삭제 → DELETE /api/workouts/{id} 6 PR       → GET /api/stats/pr
  7 기록 수정 → PATCH /api/workouts/{id}
"""
from datetime import date, datetime, timezone
from typing import Optional
from urllib.parse import urlsplit
from uuid import UUID

from fastapi import Depends, FastAPI, File, HTTPException, Query, Request, Response, UploadFile
from fastapi.responses import JSONResponse

from backend import config, strava, strava_detail, strava_webhook
from backend.auth import User, current_user
from backend.csv_import import parse_csv
from backend.db import Database, DBError, WebhookStore
from backend.schemas import Sport, StravaExchange, StravaUpload, WorkoutCreate, WorkoutUpdate
from backend.stats import monthly_stats, period_stats, personal_records, total_stats
from backend.workout import Workout, from_db

app = FastAPI(title="운동기록 API")


@app.exception_handler(DBError)
def db_error_handler(request: Request, exc: DBError):
    print(f"DB error on {request.url.path}: {exc}")          # 원문은 서버 로그에만
    return JSONResponse(status_code=400, content={"detail": "저장소 처리 중 오류가 났습니다."})


@app.exception_handler(strava.StravaError)
def strava_error_handler(request: Request, exc: strava.StravaError):
    return JSONResponse(status_code=502, content={"detail": str(exc)})


def get_db(user: User = Depends(current_user)):
    return Database(user.token)


# 통계에는 지도 경로(polyline)가 필요 없다 → 가볍게 읽는다
STATS_COLUMNS = ("id,date,started_at,sport,name,distance_km,duration_sec,avg_hr,max_hr,avg_cad,"
                 "max_cad,calories,elevation_gain_m,memo,source,external_id,kudos_count,avg_watts,"
                 "max_speed_kmh,gear_id")


def load_workouts(db):
    return [from_db(row) for row in db.list_workouts(columns=STATS_COLUMNS)]


@app.get("/api/health")
def health():
    return {"ok": True}


# ------------------------------------------------------------------
# 기록
# ------------------------------------------------------------------
@app.get("/api/workouts")
def list_workouts(sport: Optional[Sport] = None,
                  date_from: Optional[date] = None,
                  date_to: Optional[date] = None,
                  db: Database = Depends(get_db)):
    rows = db.list_workouts(sport, date_from, date_to)
    return [from_db(row).to_api() for row in rows]


@app.post("/api/workouts", status_code=201)
def add_workout(body: WorkoutCreate, db: Database = Depends(get_db)):
    w = Workout(body.date, body.sport, body.distance_km, body.duration_sec,
                body.avg_hr, body.max_hr, body.avg_cad, body.max_cad,
                body.calories, body.memo.strip(),
                name=body.name, polyline=body.polyline, elevation_gain_m=body.elevation_gain_m,
                started_at=body.started_at.isoformat() if body.started_at else None)
    row = db.insert_workouts([w.to_db()])[0]
    return from_db(row).to_api()


@app.get("/api/workouts/{workout_id}")
def get_workout(workout_id: UUID, db: Database = Depends(get_db)):
    row = db.get_workout(str(workout_id))
    if row is None:
        raise HTTPException(404, "기록을 찾을 수 없습니다.")
    return from_db(row).to_api()


@app.get("/api/workouts/{workout_id}/detail")
def get_workout_detail(workout_id: UUID, user: User = Depends(current_user)):
    """기록 한 건 + (Strava 활동이면) Strava의 구간·랩·세그먼트·그래프 데이터"""
    db = Database(user.token)
    row = db.get_workout(str(workout_id))
    if row is None:
        raise HTTPException(404, "기록을 찾을 수 없습니다.")
    result = {"workout": from_db(row).to_api(), "strava": None, "strava_error": None}
    if row.get("source") != "strava" or not row.get("external_id"):
        return result
    try:
        connection = strava_session(db, user)
        token = connection["access_token"]
        activity_id = strava.activity_id(row["external_id"])
        activity = strava.api_get(token, f"/activities/{activity_id}", "활동",
                                  include_all_efforts="true")
        try:
            streams = strava.api_get(token, f"/activities/{activity_id}/streams", "그래프 데이터",
                                     keys=strava_detail.STREAM_KEYS, key_by_type="true")
        except strava.StravaError:
            streams = None                     # 수동 입력 활동 등은 stream이 없다
        result["strava"] = strava_detail.activity_view(activity, streams)
    except (HTTPException, strava.StravaError) as exc:
        result["strava_error"] = exc.detail if isinstance(exc, HTTPException) else str(exc)
    return result


@app.patch("/api/workouts/{workout_id}")
def edit_workout(workout_id: UUID, body: WorkoutUpdate, db: Database = Depends(get_db)):
    fields = body.model_dump(mode="json", exclude_unset=True)   # 보낸 항목만 바꾼다
    if not fields:
        raise HTTPException(422, "수정할 항목이 없습니다.")
    row = db.update_workout(str(workout_id), fields)
    if row is None:
        raise HTTPException(404, "기록을 찾을 수 없습니다.")
    return from_db(row).to_api()


@app.delete("/api/workouts/{workout_id}", status_code=204)
def delete_workout(workout_id: UUID, db: Database = Depends(get_db)):
    if not db.delete_workout(str(workout_id)):
        raise HTTPException(404, "기록을 찾을 수 없습니다.")
    return Response(status_code=204)


# ------------------------------------------------------------------
# 통계
# ------------------------------------------------------------------
@app.get("/api/stats/total")
def stats_total(db: Database = Depends(get_db)):
    return total_stats(load_workouts(db))


@app.get("/api/stats/monthly")
def stats_monthly(db: Database = Depends(get_db)):
    return monthly_stats(load_workouts(db))


@app.get("/api/stats/summary")
def stats_summary(year: Optional[int] = Query(None, ge=2000, le=2100),
                  month: Optional[int] = Query(None, ge=1, le=12),
                  sport: Optional[Sport] = None,
                  db: Database = Depends(get_db)):
    """대시보드: 전체(연도별) / 연간(월별) / 월간(일별) + 종목 필터"""
    if month is not None and year is None:
        raise HTTPException(422, "월을 고르려면 연도도 함께 보내야 합니다.")
    return period_stats(load_workouts(db), year, month, sport)


@app.get("/api/stats/pr")
def stats_pr(db: Database = Depends(get_db)):
    return personal_records(load_workouts(db))


# ------------------------------------------------------------------
# CSV 가져오기 (예전 records.csv)
# ------------------------------------------------------------------
@app.post("/api/import/csv")
async def import_csv(file: UploadFile = File(...), db: Database = Depends(get_db)):
    data = await file.read(2 * 1024 * 1024 + 1)            # 제한보다 1바이트만 더 읽어 본다
    if len(data) > 2 * 1024 * 1024:
        raise HTTPException(413, "파일이 너무 큽니다. (최대 2MB)")
    try:
        workouts, skipped = parse_csv(data)
    except UnicodeDecodeError:
        raise HTTPException(422, "UTF-8 CSV 파일만 올릴 수 있습니다.")
    except ValueError as exc:
        raise HTTPException(422, str(exc))
    inserted = db.insert_workouts([w.to_db() for w in workouts], skip_duplicates=True)
    return {"imported": len(inserted), "skipped": skipped + len(workouts) - len(inserted)}


# ------------------------------------------------------------------
# Strava
# ------------------------------------------------------------------
def strava_status(connection):
    return {
        "configured": config.strava_configured(),
        "connected": connection is not None,
        "athlete_id": connection["athlete_id"] if connection else None,
        "athlete_name": connection["athlete_name"] if connection else None,
        "last_synced_at": connection["last_synced_at"] if connection else None,
        "can_upload": bool(connection) and strava.WRITE_SCOPE in (connection.get("scope") or ""),
    }


def require_strava_config():
    if not config.strava_configured():
        raise HTTPException(400, "서버에 Strava 앱 설정이 아직 없습니다.")


@app.get("/api/strava/status")
def get_strava_status(db: Database = Depends(get_db)):
    return strava_status(db.get_strava_connection())


@app.get("/api/strava/authorize-url")
def get_strava_authorize_url(redirect_uri: str = Query(..., max_length=300),
                             user: User = Depends(current_user)):
    require_strava_config()
    parts = urlsplit(redirect_uri)
    origin = f"{parts.scheme}://{parts.netloc}"
    if origin not in config.ALLOWED_ORIGINS or parts.path != "/strava/callback" or parts.query:
        raise HTTPException(422, "redirect_uri가 올바르지 않습니다.")
    return {"url": strava.authorize_url(redirect_uri, user.id)}


@app.post("/api/strava/exchange")
def exchange_strava_code(body: StravaExchange, user: User = Depends(current_user)):
    require_strava_config()
    if not strava.check_state(body.state, user.id):
        raise HTTPException(400, "연결 요청이 만료되었거나 올바르지 않습니다. 다시 연결해 주세요.")
    row = strava.exchange_code(body.code)
    row["user_id"] = user.id
    row["scope"] = body.scope or strava.SCOPE     # 사용자가 일부 권한을 끄고 허용할 수도 있다
    db = Database(user.token)
    return strava_status(db.save_strava_connection(row))


def strava_session(db, user):
    """연결 정보를 읽고, 토큰이 만료됐으면 갱신해서 저장한 뒤 돌려준다."""
    require_strava_config()
    connection = db.get_strava_connection()
    if connection is None:
        raise HTTPException(400, "Strava에 연결되어 있지 않습니다.")
    new_token = strava.refresh_if_needed(connection)
    if new_token:
        db.update_strava_connection(user.id, new_token)
        connection.update(new_token)
    return connection


@app.post("/api/strava/sync")
def sync_strava(update: bool = False, user: User = Depends(current_user)):
    """update=true면 이미 있는 Strava 기록도 새 값으로 바꾼다 (메모는 그대로)."""
    db = Database(user.token)
    connection = strava_session(db, user)

    # 1) 지난번에 가져온 활동 이후 것만 가져온다 (처음이면 전부)
    cursor = connection.get("sync_cursor")
    after = int(datetime.fromisoformat(cursor).timestamp()) if cursor else 0
    activities, has_more = strava.fetch_activities(connection["access_token"], after)

    # 2) Workout으로 바꿔 저장
    rows = [strava.to_workout(a).to_db() for a in activities]
    if update:
        for row in rows:
            row.pop("memo")                      # 사용자가 쓴 메모는 덮어쓰지 않는다
        written = db.insert_workouts(rows, update_existing=True)
    else:
        written = db.insert_workouts(rows, skip_duplicates=True)

    # 3) 다음 동기화 시작점과 마지막 동기화 시각 기록
    now = datetime.now(timezone.utc).isoformat()
    fields = {"last_synced_at": now}
    if activities:
        fields["sync_cursor"] = max(a["start_date"] for a in activities)
    db.update_strava_connection(user.id, fields)

    return {"fetched": len(activities), "imported": len(written),
            "has_more": has_more, "last_synced_at": now}


@app.post("/api/strava/resync")
def resync_strava(user: User = Depends(current_user)):
    """동기화 시작점을 처음으로 되돌린다. 이어서 sync?update=true 를 반복 호출한다."""
    db = Database(user.token)
    strava_session(db, user)
    db.update_strava_connection(user.id, {"sync_cursor": None})
    return {"ok": True}


@app.get("/api/strava/profile")
def strava_profile(user: User = Depends(current_user)):
    db = Database(user.token)
    token = strava_session(db, user)["access_token"]
    athlete = strava.api_get(token, "/athlete", "프로필")
    stats = strava.api_get(token, f"/athletes/{athlete['id']}/stats", "누적 기록")
    return strava_detail.profile_view(athlete, stats)


@app.get("/api/strava/segments")
def strava_segments(user: User = Depends(current_user)):
    db = Database(user.token)
    token = strava_session(db, user)["access_token"]
    starred = strava.api_get(token, "/segments/starred", "세그먼트", per_page=100)
    return {"segments": [strava_detail.segment_view(s) for s in starred]}


@app.post("/api/strava/upload")
def strava_upload(body: StravaUpload, user: User = Depends(current_user)):
    """라이브 기록(GPS 점들)을 GPX로 만들어 Strava에 올린다."""
    db = Database(user.token)
    connection = strava_session(db, user)
    if strava.WRITE_SCOPE not in (connection.get("scope") or ""):
        raise HTTPException(403, "Strava 업로드 권한이 없습니다. 연결을 해제하고 다시 연결해 주세요.")
    points = sorted(body.points, key=lambda p: p.time)
    gpx = strava_detail.build_gpx(body.name, [p.model_dump() for p in points])
    res = strava.upload_gpx(connection["access_token"], gpx, body.name, body.description,
                            strava_detail.UPLOAD_TYPES.get(body.sport, "workout"))
    return {"upload_id": res.get("id"), "status": res.get("status"), "activity_id": res.get("activity_id")}


@app.get("/api/strava/upload/{upload_id}")
def strava_upload_status(upload_id: int, user: User = Depends(current_user)):
    db = Database(user.token)
    token = strava_session(db, user)["access_token"]
    res = strava.api_get(token, f"/uploads/{upload_id}", "업로드 상태")
    return {"status": res.get("status"), "activity_id": res.get("activity_id"), "error": res.get("error")}


@app.post("/api/workouts/{workout_id}/strava")
def push_workout_to_strava(workout_id: UUID, user: User = Depends(current_user)):
    """앱에서 입력한 기록을 Strava '수동 활동'으로 만든다. 만든 뒤에는 그 Strava 활동과 연결해
    다음 동기화·웹훅이 같은 활동을 또 가져오지 않게 한다."""
    db = Database(user.token)
    row = db.get_workout(str(workout_id))
    if row is None:
        raise HTTPException(404, "기록을 찾을 수 없습니다.")
    if row.get("source") == "strava":
        raise HTTPException(409, "이미 Strava에 있는 기록입니다.")
    connection = strava_session(db, user)
    if strava.WRITE_SCOPE not in (connection.get("scope") or ""):
        raise HTTPException(403, "Strava 업로드 권한이 없습니다. 연결을 해제하고 다시 연결해 주세요.")

    w = from_db(row)
    # 시작 시각을 모르면 그날 정오로 둔다 (Strava는 시작 시각이 꼭 필요)
    start = (datetime.fromisoformat(w.started_at).astimezone().strftime("%Y-%m-%dT%H:%M:%S")
             if w.started_at else f"{w.date}T12:00:00")
    activity = strava.create_activity(connection["access_token"], w, start)
    external_id = str(activity["id"])
    try:
        updated = db.update_workout(str(workout_id), {"source": "strava", "external_id": external_id})
    except DBError:
        # 웹훅이 먼저 같은 활동을 저장했다 → 그 기록을 남기고 원래 수동 기록은 지운다
        existing = db.find_workout("strava", external_id)
        if existing is None:
            raise
        db.delete_workout(str(workout_id))
        return from_db(existing).to_api()
    return from_db(updated).to_api()


# ------------------------------------------------------------------
# Strava 웹훅: Strava에서 활동이 생기거나 바뀌거나 지워지면 자동 반영
# ------------------------------------------------------------------
@app.get("/api/strava/webhook")
def strava_webhook_verify(request: Request):
    """구독 등록 때 Strava가 보내는 확인 요청에 challenge를 돌려준다."""
    q = request.query_params
    token = config.STRAVA_WEBHOOK_VERIFY_TOKEN
    if q.get("hub.mode") != "subscribe" or not token or q.get("hub.verify_token") != token:
        raise HTTPException(403, "확인 실패")
    return {"hub.challenge": q.get("hub.challenge", "")}


@app.post("/api/strava/webhook")
async def strava_webhook_event(request: Request):
    if not (config.strava_configured() and config.STRAVA_WEBHOOK_SECRET):
        raise HTTPException(503, "웹훅이 설정되지 않았습니다.")
    try:
        event = await request.json()
    except ValueError:
        raise HTTPException(400, "JSON이 아닙니다.")
    if not isinstance(event, dict):
        raise HTTPException(400, "이벤트 형식이 아닙니다.")
    store = WebhookStore(config.STRAVA_WEBHOOK_SECRET)
    try:
        result = strava_webhook.handle_event(event, store, config.STRAVA_WEBHOOK_SUBSCRIPTION_ID or None)
    except strava.StravaError as exc:
        if exc.status == 429:
            raise HTTPException(503, "잠시 후 다시")      # Strava가 재시도한다
        result = f"strava error: {exc}"
    print(f"strava webhook {event.get('aspect_type')} {event.get('object_type')} -> {result}")
    return {"ok": True}


@app.delete("/api/strava/connection", status_code=204)
def disconnect_strava(db: Database = Depends(get_db), user: User = Depends(current_user)):
    db.delete_strava_connection(user.id)
    return Response(status_code=204)
