"""API 경로 테스트. 진짜 Supabase 대신 메모리 가짜 DB를 쓴다."""
import uuid

import pytest
from fastapi.testclient import TestClient

from backend import main
from backend.auth import User, current_user


class FakeDatabase:
    rows = []

    def __init__(self, token):
        pass

    def list_workouts(self, sport=None, date_from=None, date_to=None, columns="*"):
        rows = [r for r in self.rows if sport is None or r["sport"] == sport]
        return sorted(rows, key=lambda r: r["date"], reverse=True)

    def get_workout(self, workout_id):
        return next((r for r in self.rows if r["id"] == workout_id), None)

    def insert_workouts(self, rows, skip_duplicates=False, update_existing=False):
        added = []
        for i, row in enumerate(rows):
            same = next((r for r in self.rows if r.get("external_id") and r["source"] == row["source"]
                         and r["external_id"] == row["external_id"]), None)
            if update_existing and same:
                same.update(row)
                added.append(same)
                continue
            if skip_duplicates and any(r["source"] == row["source"] and r["external_id"] == row["external_id"]
                                       for r in self.rows):
                continue
            new = {**row, "id": str(uuid.uuid4())}
            self.rows.append(new)
            added.append(new)
        return added

    def update_workout(self, workout_id, fields):
        for r in self.rows:
            if r["id"] == workout_id:
                r.update(fields)
                return r
        return None

    def delete_workout(self, workout_id):
        before = len(self.rows)
        FakeDatabase.rows = [r for r in self.rows if r["id"] != workout_id]
        return len(FakeDatabase.rows) < before

    connection = None
    updates = []

    def get_strava_connection(self):
        return FakeDatabase.connection

    def update_strava_connection(self, user_id, fields):
        FakeDatabase.updates.append(fields)


@pytest.fixture
def client(monkeypatch):
    FakeDatabase.rows = []
    FakeDatabase.connection = None
    FakeDatabase.updates = []
    monkeypatch.setattr(main, "Database", FakeDatabase)
    main.app.dependency_overrides[current_user] = lambda: User("user-1", "a@b.c", "token")
    yield TestClient(main.app)
    main.app.dependency_overrides.clear()


RUN = {"date": "2026-10-01", "sport": "러닝", "distance_km": 5.0, "duration_sec": 1620,
       "avg_hr": 160, "max_hr": None, "memo": "태화강 런"}


def test_requires_login():
    res = TestClient(main.app).get("/api/workouts")
    assert res.status_code == 401


def test_create_list_update_delete(client):
    res = client.post("/api/workouts", json=RUN)
    assert res.status_code == 201
    created = res.json()
    assert created["summary"] == "평균페이스: 5분 24초 /km"
    assert created["source"] == "manual"

    assert len(client.get("/api/workouts").json()) == 1

    res = client.patch(f"/api/workouts/{created['id']}", json={"memo": "수정됨"})
    assert res.json()["memo"] == "수정됨"

    assert client.delete(f"/api/workouts/{created['id']}").status_code == 204
    assert client.delete(f"/api/workouts/{created['id']}").status_code == 404


def test_validation(client):
    assert client.post("/api/workouts", json={**RUN, "distance_km": 0}).status_code == 422
    assert client.post("/api/workouts", json={**RUN, "sport": "축구"}).status_code == 422
    assert client.post("/api/workouts", json={**RUN, "date": "2026-13-01"}).status_code == 422
    assert client.patch("/api/workouts/x", json={"distance_km": None}).status_code == 422
    assert client.patch("/api/workouts/x", json={}).status_code == 422


def test_stats(client):
    client.post("/api/workouts", json=RUN)
    client.post("/api/workouts", json={**RUN, "sport": "바이크", "distance_km": 40, "duration_sec": 7200})
    assert client.get("/api/stats/total").json()["distance_km"] == 45.0
    assert client.get("/api/stats/monthly").json()[0]["count"] == 2
    assert client.get("/api/stats/pr").json()["best_bike"]["summary"] == "평균속도: 20.0 km/h"


def test_stats_summary(client):
    client.post("/api/workouts", json=RUN)
    client.post("/api/workouts", json={**RUN, "sport": "바이크", "distance_km": 40, "duration_sec": 7200})
    year = int(RUN["date"][:4])
    s = client.get("/api/stats/summary", params={"year": year, "sport": "바이크"}).json()
    assert s["unit"] == "month" and s["total"]["distance_km"] == 40.0
    assert {x["sport"] for x in s["by_sport"]} == {"러닝", "바이크"}
    assert client.get("/api/stats/summary", params={"month": 10}).status_code == 422
    assert client.get("/api/stats/summary", params={"year": year, "month": 13}).status_code == 422
    assert client.get("/api/stats/summary", params={"sport": "축구"}).status_code == 422


def test_csv_import_skips_duplicates(client):
    data = "날짜,종목,거리(km),시간(분),평균심박,최대심박,평균케이던스,최대케이던스,칼로리,메모\n" \
           "2026-10-01,러닝,5.0,30,160,180,170,180,450,태화강 런\n"
    files = {"file": ("records.csv", data.encode("utf-8-sig"), "text/csv")}
    assert client.post("/api/import/csv", files=files).json() == {"imported": 1, "skipped": 0}
    assert client.post("/api/import/csv", files=files).json() == {"imported": 0, "skipped": 1}


def test_strava_status_without_config(client, monkeypatch):
    monkeypatch.setattr(main.config, "STRAVA_CLIENT_ID", "")
    body = client.get("/api/strava/status").json()
    assert body["configured"] is False and body["connected"] is False
    assert client.get("/api/strava/authorize-url?redirect_uri=https://x/strava/callback").status_code == 400


def test_strava_sync_imports_only_new(client, monkeypatch):
    from tests.test_strava_mapping import GRANFONDO, NIGHT_RUN
    monkeypatch.setattr(main.config, "STRAVA_CLIENT_ID", "1")
    monkeypatch.setattr(main.config, "STRAVA_CLIENT_SECRET", "s")
    FakeDatabase.connection = {"access_token": "old", "refresh_token": "r",
                               "expires_at": "2000-01-01T00:00:00+00:00", "sync_cursor": None}
    monkeypatch.setattr(main.strava, "refresh_if_needed",
                        lambda conn: {"access_token": "new", "refresh_token": "r2",
                                      "expires_at": "2099-01-01T00:00:00+00:00"})
    calls = []

    def fake_fetch(token, after):
        calls.append((token, after))
        return [GRANFONDO, NIGHT_RUN], False
    monkeypatch.setattr(main.strava, "fetch_activities", fake_fetch)

    body = client.post("/api/strava/sync").json()
    assert body["fetched"] == 2 and body["imported"] == 2
    assert calls == [("new", 0)]                                  # 갱신된 토큰, 처음부터
    assert FakeDatabase.updates[0]["access_token"] == "new"       # 새 토큰 저장
    assert FakeDatabase.updates[-1]["sync_cursor"] == NIGHT_RUN["start_date"]

    body = client.post("/api/strava/sync").json()                 # 같은 활동을 다시 받아도
    assert body["imported"] == 0                                  # 중복 저장 안 함


# ------------------------------------------------------------------
# PACEHUB 화면용 API
# ------------------------------------------------------------------
W1 = "11111111-1111-4111-8111-111111111111"


def strava_ready(monkeypatch, scope="read,activity:read_all"):
    monkeypatch.setattr(main.config, "STRAVA_CLIENT_ID", "1")
    monkeypatch.setattr(main.config, "STRAVA_CLIENT_SECRET", "s")
    FakeDatabase.connection = {"access_token": "tok", "refresh_token": "r", "scope": scope,
                               "expires_at": "2099-01-01T00:00:00+00:00", "sync_cursor": None,
                               "athlete_id": 1, "athlete_name": "A", "last_synced_at": None}
    monkeypatch.setattr(main.strava, "refresh_if_needed", lambda conn: None)


def test_get_one_and_live_fields(client):
    live = {**RUN, "name": "라이브 런", "polyline": "abc", "elevation_gain_m": 12.5,
            "started_at": "2026-10-01T06:00:00+09:00"}
    created = client.post("/api/workouts", json=live).json()
    assert created["name"] == "라이브 런" and created["polyline"] == "abc"
    got = client.get(f"/api/workouts/{created['id']}").json()
    assert got["elevation_gain_m"] == 12.5 and got["started_at"].startswith("2026-10-01T06:00:00")
    assert client.get(f"/api/workouts/{uuid.uuid4()}").status_code == 404
    assert client.get("/api/workouts/nope").status_code == 422          # uuid가 아니면 DB까지 가지 않음


def test_detail_manual_has_no_strava(client):
    created = client.post("/api/workouts", json=RUN).json()
    body = client.get(f"/api/workouts/{created['id']}/detail").json()
    assert body["workout"]["id"] == created["id"] and body["strava"] is None
    assert body["strava_error"] is None


def test_detail_strava_activity(client, monkeypatch):
    from tests.test_strava_detail import ACTIVITY, STREAMS
    strava_ready(monkeypatch)
    FakeDatabase.rows = [{"id": W1, "date": "2026-10-01", "sport": "러닝", "distance_km": 5.01,
                          "duration_sec": 1599, "source": "strava", "external_id": "20406610343"}]
    calls = []

    def fake_get(token, path, what, **params):
        calls.append(path)
        return STREAMS if path.endswith("/streams") else ACTIVITY

    monkeypatch.setattr(main.strava, "api_get", fake_get)
    body = client.get(f"/api/workouts/{W1}/detail").json()
    assert calls == ["/activities/20406610343", "/activities/20406610343/streams"]
    assert body["strava"]["splits"][0]["pace_sec_per_km"] == 310
    assert body["strava"]["streams"]["heartrate"] == [150, 160, 170]


def test_detail_strava_not_connected_shows_error(client, monkeypatch):
    monkeypatch.setattr(main.config, "STRAVA_CLIENT_ID", "1")
    monkeypatch.setattr(main.config, "STRAVA_CLIENT_SECRET", "s")
    FakeDatabase.rows = [{"id": W1, "date": "2026-10-01", "sport": "러닝", "distance_km": 5.0,
                          "duration_sec": 1599, "source": "strava", "external_id": "1"}]
    body = client.get(f"/api/workouts/{W1}/detail").json()
    assert body["strava"] is None and "연결" in body["strava_error"]


def test_upload_needs_write_scope(client, monkeypatch):
    strava_ready(monkeypatch)
    points = [{"lat": 35.5, "lng": 129.3, "time": "2026-10-21T06:00:00Z"},
              {"lat": 35.501, "lng": 129.301, "time": "2026-10-21T06:00:10Z"}]
    payload = {"name": "Morning Run", "sport": "러닝", "points": points}
    assert client.post("/api/strava/upload", json=payload).status_code == 403
    assert client.get("/api/strava/status").json()["can_upload"] is False

    FakeDatabase.connection["scope"] = "read,activity:read_all,activity:write"
    sent = {}

    def fake_upload(token, gpx, name, description, activity_type):
        sent.update(gpx=gpx, type=activity_type)
        return {"id": 99, "status": "processing", "activity_id": None}

    monkeypatch.setattr(main.strava, "upload_gpx", fake_upload)
    body = client.post("/api/strava/upload", json=payload).json()
    assert body == {"upload_id": 99, "status": "processing", "activity_id": None}
    assert sent["type"] == "run" and sent["gpx"].count("<trkpt") == 2


def test_resync_then_update_keeps_memo(client, monkeypatch):
    from tests.test_strava_mapping import NIGHT_RUN
    strava_ready(monkeypatch)
    monkeypatch.setattr(main.strava, "fetch_activities", lambda token, after: ([NIGHT_RUN], False))
    client.post("/api/strava/sync")
    FakeDatabase.rows[0]["memo"] = "내 메모"
    assert client.post("/api/strava/resync").json() == {"ok": True}
    assert FakeDatabase.updates[-1] == {"sync_cursor": None}

    changed = {**NIGHT_RUN, "kudos_count": 7, "map": {"summary_polyline": "xyz"}}
    monkeypatch.setattr(main.strava, "fetch_activities", lambda token, after: ([changed], False))
    body = client.post("/api/strava/sync?update=true").json()
    assert body["imported"] == 1 and len(FakeDatabase.rows) == 1
    row = FakeDatabase.rows[0]
    assert row["kudos_count"] == 7 and row["polyline"] == "xyz" and row["memo"] == "내 메모"


# ------------------------------------------------------------------
# 수동 기록 → Strava, 웹훅, 보안 수정
# ------------------------------------------------------------------
def test_push_manual_workout_to_strava(client, monkeypatch):
    created = client.post("/api/workouts", json=RUN).json()
    strava_ready(monkeypatch)
    assert client.post(f"/api/workouts/{created['id']}/strava").status_code == 403   # 쓰기 권한 없음

    FakeDatabase.connection["scope"] = "read,activity:read_all,activity:write"
    sent = {}

    def fake_create(token, workout, start):
        sent.update(name=workout.name, start=start, distance=workout.distance_km)
        return {"id": 555}

    monkeypatch.setattr(main.strava, "create_activity", fake_create)
    body = client.post(f"/api/workouts/{created['id']}/strava").json()
    assert body["source"] == "strava" and body["external_id"] == "555"
    assert sent["start"] == "2026-10-01T12:00:00" and sent["distance"] == 5.0
    assert client.post(f"/api/workouts/{created['id']}/strava").status_code == 409   # 두 번은 안 됨


def test_webhook_verify(client, monkeypatch):
    monkeypatch.setattr(main.config, "STRAVA_WEBHOOK_VERIFY_TOKEN", "vt")
    ok = client.get("/api/strava/webhook", params={"hub.mode": "subscribe", "hub.verify_token": "vt",
                                                    "hub.challenge": "abc"})
    assert ok.json() == {"hub.challenge": "abc"}
    bad = client.get("/api/strava/webhook", params={"hub.mode": "subscribe", "hub.verify_token": "x",
                                                     "hub.challenge": "abc"})
    assert bad.status_code == 403


def test_webhook_event_not_configured(client, monkeypatch):
    monkeypatch.setattr(main.config, "STRAVA_WEBHOOK_SECRET", "")
    assert client.post("/api/strava/webhook", json={"object_type": "activity"}).status_code == 503


def test_webhook_event_calls_handler(client, monkeypatch):
    monkeypatch.setattr(main.config, "STRAVA_CLIENT_ID", "1")
    monkeypatch.setattr(main.config, "STRAVA_CLIENT_SECRET", "s")
    monkeypatch.setattr(main.config, "STRAVA_WEBHOOK_SECRET", "ws")
    seen = {}
    monkeypatch.setattr(main.strava_webhook, "handle_event",
                        lambda event, store, sub: seen.update(event=event, secret=store.secret) or "saved")
    assert client.post("/api/strava/webhook", json={"object_type": "activity"}).json() == {"ok": True}
    assert seen["secret"] == "ws"
    assert client.post("/api/strava/webhook", content=b"not json").status_code == 400


def test_authorize_url_only_allows_known_callbacks(client, monkeypatch):
    monkeypatch.setattr(main.config, "STRAVA_CLIENT_ID", "1")
    monkeypatch.setattr(main.config, "STRAVA_CLIENT_SECRET", "s")
    url = "/api/strava/authorize-url"
    ok = client.get(url, params={"redirect_uri": "https://workout-eight-gamma.vercel.app/strava/callback"})
    assert ok.status_code == 200
    for bad in ("https://evil.example/strava/callback", "http://localhost.evil.example/strava/callback",
                "https://workout-eight-gamma.vercel.app/other", "javascript:alert(1)"):
        assert client.get(url, params={"redirect_uri": bad}).status_code == 422, bad


def test_db_error_does_not_leak_details(client, monkeypatch):
    def boom(self, *a, **k):
        raise main.DBError('DB 오류 400: {"code":"22P02","message":"secret detail"}')
    monkeypatch.setattr(FakeDatabase, "list_workouts", boom)
    body = client.get("/api/workouts").json()
    assert body == {"detail": "저장소 처리 중 오류가 났습니다."}


def test_csv_rejects_non_finite_and_huge_numbers(client):
    data = ("날짜,종목,거리(km),시간(분)\n"
            "2026-10-21,러닝,5,inf\n2026-10-21,러닝,nan,30\n2026-10-21,러닝,1e400,30\n"
            "2026-10-21,러닝,5,30\n")
    files = {"file": ("r.csv", data.encode("utf-8"), "text/csv")}
    assert client.post("/api/import/csv", files=files).json() == {"imported": 1, "skipped": 3}
