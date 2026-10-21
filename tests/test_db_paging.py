"""Supabase는 한 번에 1000행까지만 주므로 list_workouts가 끝까지 이어 받는지 검사한다."""
import httpx

from backend import db


def test_list_workouts_reads_all_pages(monkeypatch):
    total = 2500
    calls = []

    def fake_request(method, url, params=None, **kwargs):
        p = dict(params)
        calls.append((p["limit"], p["offset"]))
        rows = [{"id": i} for i in range(p["offset"], min(p["offset"] + p["limit"], total))]
        return httpx.Response(200, json=rows)

    monkeypatch.setattr(db.httpx, "request", fake_request)
    rows = db.Database("token").list_workouts()
    assert len(rows) == 2500 and rows[-1]["id"] == 2499
    assert calls == [(1000, 0), (1000, 1000), (1000, 2000)]
