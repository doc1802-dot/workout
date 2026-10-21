"""Supabase(PostgREST) 읽기/쓰기.

cli/storage.py 의 CSV 읽기/쓰기를 바꾼 것이다.
요청마다 '로그인한 사용자의 토큰'으로 접속하므로, DB의 RLS 정책이
본인 데이터만 보이게 막아 준다. (서버가 실수해도 남의 기록은 안 보임)
"""
import httpx

from backend import config


PAGE_SIZE = 1000


class DBError(Exception):
    pass


class Database:
    def __init__(self, access_token):
        self.base = f"{config.SUPABASE_URL}/rest/v1"
        self.headers = {
            "apikey": config.SUPABASE_PUBLISHABLE_KEY,
            "Authorization": f"Bearer {access_token}",
        }

    def _request(self, method, table, params=None, json=None, prefer=None):
        headers = dict(self.headers)
        if prefer:
            headers["Prefer"] = prefer
        res = httpx.request(method, f"{self.base}/{table}", params=params,
                            json=json, headers=headers, timeout=15)
        if res.status_code >= 400:
            raise DBError(f"DB 오류 {res.status_code}: {res.text}")
        if res.status_code == 204 or res.text == "":
            return []
        return res.json()

    # ------------------------------------------------------------------
    # workouts
    # ------------------------------------------------------------------
    def list_workouts(self, sport=None, date_from=None, date_to=None):
        # 마지막 id는 나눠 받을 때 순서가 흔들리지 않게 하는 기준
        params = [("select", "*"), ("order", "date.desc,started_at.desc.nullslast,created_at.desc,id")]
        if sport:
            params.append(("sport", f"eq.{sport}"))
        if date_from:
            params.append(("date", f"gte.{date_from}"))
        if date_to:
            params.append(("date", f"lte.{date_to}"))
        # Supabase는 한 번에 최대 1000행만 준다 → 1000개씩 끝까지 이어 받는다
        rows = []
        while True:
            page = self._request("GET", "workouts", params=params + [
                ("limit", PAGE_SIZE), ("offset", len(rows))])
            rows.extend(page)
            if len(page) < PAGE_SIZE:
                return rows

    def insert_workouts(self, rows, skip_duplicates=False):
        """여러 행을 한 번에 넣는다. skip_duplicates면 이미 있는 (source, external_id)는 건너뛴다."""
        if not rows:
            return []
        if skip_duplicates:
            return self._request(
                "POST", "workouts", params={"on_conflict": "user_id,source,external_id"},
                json=rows, prefer="resolution=ignore-duplicates,return=representation")
        return self._request("POST", "workouts", json=rows, prefer="return=representation")

    def update_workout(self, workout_id, fields):
        rows = self._request("PATCH", "workouts", params={"id": f"eq.{workout_id}"},
                             json=fields, prefer="return=representation")
        return rows[0] if rows else None

    def delete_workout(self, workout_id):
        rows = self._request("DELETE", "workouts", params={"id": f"eq.{workout_id}"},
                             prefer="return=representation")
        return len(rows) > 0

    # ------------------------------------------------------------------
    # strava_connections (사용자당 1행)
    # ------------------------------------------------------------------
    def get_strava_connection(self):
        rows = self._request("GET", "strava_connections", params={"select": "*"})
        return rows[0] if rows else None

    def save_strava_connection(self, row):
        rows = self._request("POST", "strava_connections", params={"on_conflict": "user_id"},
                             json=row, prefer="resolution=merge-duplicates,return=representation")
        return rows[0]

    def update_strava_connection(self, user_id, fields):
        self._request("PATCH", "strava_connections", params={"user_id": f"eq.{user_id}"},
                      json=fields, prefer="return=minimal")

    def delete_strava_connection(self, user_id):
        self._request("DELETE", "strava_connections", params={"user_id": f"eq.{user_id}"})
