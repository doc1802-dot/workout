"""API 경로 테스트. 진짜 Supabase 대신 메모리 가짜 DB를 쓴다."""
import pytest
from fastapi.testclient import TestClient

from backend import main
from backend.auth import User, current_user


class FakeDatabase:
    rows = []

    def __init__(self, token):
        pass

    def list_workouts(self, sport=None, date_from=None, date_to=None):
        rows = [r for r in self.rows if sport is None or r["sport"] == sport]
        return sorted(rows, key=lambda r: r["date"], reverse=True)

    def insert_workouts(self, rows, skip_duplicates=False):
        added = []
        for i, row in enumerate(rows):
            if skip_duplicates and any(r["source"] == row["source"] and r["external_id"] == row["external_id"]
                                       for r in self.rows):
                continue
            new = {**row, "id": f"id-{len(self.rows) + i}"}
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
