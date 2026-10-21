"""운동기록 API (FastAPI).

cli/main.py 의 메뉴 번호가 여기서는 주소(URL)가 된다.
  1 기록 추가 → POST /api/workouts        2 기록 보기 → GET /api/workouts
  3 합계     → GET /api/stats/total      4 월별 합계 → GET /api/stats/monthly
  5 기록 삭제 → DELETE /api/workouts/{id} 6 PR       → GET /api/stats/pr
  7 기록 수정 → PATCH /api/workouts/{id}
"""
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import Depends, FastAPI, File, HTTPException, Query, Request, Response, UploadFile
from fastapi.responses import JSONResponse

from backend import config, strava
from backend.auth import User, current_user
from backend.csv_import import parse_csv
from backend.db import Database, DBError
from backend.schemas import Sport, StravaExchange, WorkoutCreate, WorkoutUpdate
from backend.stats import monthly_stats, personal_records, total_stats
from backend.workout import Workout, from_db

app = FastAPI(title="운동기록 API")


@app.exception_handler(DBError)
def db_error_handler(request: Request, exc: DBError):
    return JSONResponse(status_code=400, content={"detail": "저장소 처리 중 오류가 났습니다.", "error": str(exc)})


@app.exception_handler(strava.StravaError)
def strava_error_handler(request: Request, exc: strava.StravaError):
    return JSONResponse(status_code=502, content={"detail": str(exc)})


def get_db(user: User = Depends(current_user)):
    return Database(user.token)


def load_workouts(db):
    return [from_db(row) for row in db.list_workouts()]


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
                body.calories, body.memo.strip())
    row = db.insert_workouts([w.to_db()])[0]
    return from_db(row).to_api()


@app.patch("/api/workouts/{workout_id}")
def edit_workout(workout_id: str, body: WorkoutUpdate, db: Database = Depends(get_db)):
    fields = body.model_dump(mode="json", exclude_unset=True)   # 보낸 항목만 바꾼다
    if not fields:
        raise HTTPException(422, "수정할 항목이 없습니다.")
    row = db.update_workout(workout_id, fields)
    if row is None:
        raise HTTPException(404, "기록을 찾을 수 없습니다.")
    return from_db(row).to_api()


@app.delete("/api/workouts/{workout_id}", status_code=204)
def delete_workout(workout_id: str, db: Database = Depends(get_db)):
    if not db.delete_workout(workout_id):
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


@app.get("/api/stats/pr")
def stats_pr(db: Database = Depends(get_db)):
    return personal_records(load_workouts(db))


# ------------------------------------------------------------------
# CSV 가져오기 (예전 records.csv)
# ------------------------------------------------------------------
@app.post("/api/import/csv")
async def import_csv(file: UploadFile = File(...), db: Database = Depends(get_db)):
    data = await file.read()
    if len(data) > 2 * 1024 * 1024:
        raise HTTPException(413, "파일이 너무 큽니다. (최대 2MB)")
    try:
        workouts, skipped = parse_csv(data)
    except UnicodeDecodeError:
        raise HTTPException(422, "UTF-8 CSV 파일만 올릴 수 있습니다.")
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
    if not redirect_uri.startswith(("https://", "http://localhost", "http://127.0.0.1")):
        raise HTTPException(422, "redirect_uri가 올바르지 않습니다.")
    return {"url": strava.authorize_url(redirect_uri, user.id)}


@app.post("/api/strava/exchange")
def exchange_strava_code(body: StravaExchange, user: User = Depends(current_user)):
    require_strava_config()
    if not strava.check_state(body.state, user.id):
        raise HTTPException(400, "연결 요청이 만료되었거나 올바르지 않습니다. 다시 연결해 주세요.")
    row = strava.exchange_code(body.code)
    row["user_id"] = user.id
    row["scope"] = strava.SCOPE
    db = Database(user.token)
    return strava_status(db.save_strava_connection(row))


@app.post("/api/strava/sync")
def sync_strava(user: User = Depends(current_user)):
    require_strava_config()
    db = Database(user.token)
    connection = db.get_strava_connection()
    if connection is None:
        raise HTTPException(400, "Strava가 연결되어 있지 않습니다.")

    # 1) 토큰이 만료됐으면 갱신해서 저장
    new_token = strava.refresh_if_needed(connection)
    if new_token:
        db.update_strava_connection(user.id, new_token)
        connection.update(new_token)

    # 2) 지난번에 가져온 활동 이후 것만 가져온다 (처음이면 전부)
    cursor = connection.get("sync_cursor")
    after = int(datetime.fromisoformat(cursor).timestamp()) if cursor else 0
    activities, has_more = strava.fetch_activities(connection["access_token"], after)

    # 3) Workout으로 바꿔 저장 (이미 있는 활동은 건너뜀)
    rows = [strava.to_workout(a).to_db() for a in activities]
    inserted = db.insert_workouts(rows, skip_duplicates=True)

    # 4) 다음 동기화 시작점과 마지막 동기화 시각 기록
    now = datetime.now(timezone.utc).isoformat()
    fields = {"last_synced_at": now}
    if activities:
        fields["sync_cursor"] = max(a["start_date"] for a in activities)
    db.update_strava_connection(user.id, fields)

    return {"fetched": len(activities), "imported": len(inserted),
            "has_more": has_more, "last_synced_at": now}


@app.delete("/api/strava/connection", status_code=204)
def disconnect_strava(db: Database = Depends(get_db), user: User = Depends(current_user)):
    db.delete_strava_connection(user.id)
    return Response(status_code=204)
