"""Strava MCP로 받은 활동 JSON → workouts INSERT SQL.

사용법 (Claude가 /strava-sync 스킬에서 실행한다):
    python scripts/strava_mcp_sync.py --user-id <uuid> [--performance perf.json] page1.json page2.json ...

- page*.json: list_activities 결과 그대로({"activities": [...]}) 또는 활동 리스트
- perf.json: {"<활동 id>": get_activity_performance 결과, ...} (심박을 채울 때만)
- 출력 SQL은 Supabase MCP execute_sql로 실행한다. 이미 있는 활동은 건너뛴다(on conflict do nothing).
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.strava_mcp import to_workout  # noqa: E402

# 활동마다 달라지는 값만 VALUES에 넣는다 (user_id, source 등은 SELECT에서 한 번만 → SQL이 절반으로 줄어든다)
COLUMNS = ["external_id", "date", "sport", "name", "distance_km", "duration_sec",
           "avg_hr", "max_hr", "avg_cad", "calories", "elevation_gain_m"]
SELECT = ("select '{user_id}'::uuid, date::date, sport, name, distance_km::numeric, "
          "duration_sec::int, avg_hr::int, max_hr::int, avg_cad::int, calories::int, "
          "elevation_gain_m::numeric, 'strava', external_id")


def literal(value):
    if value is None:
        return "null"
    if isinstance(value, (int, float)):
        return repr(value)
    return "'" + str(value).replace("'", "''") + "'"


def load_activities(paths):
    activities = {}
    for path in paths:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        for activity in data["activities"] if isinstance(data, dict) else data:
            activities[str(activity["id"])] = activity        # 페이지가 겹쳐도 한 번만
    return list(activities.values())


def build_sql(user_id, activities, performance=None, batch=200):
    performance = performance or {}
    rows = []
    for activity in activities:
        row = to_workout(activity, performance.get(str(activity["id"]))).to_db()
        rows.append("(" + ",".join(literal(row[c]) for c in COLUMNS) + ")")

    head = ("insert into public.workouts (user_id, date, sport, name, distance_km, duration_sec, "
            "avg_hr, max_hr, avg_cad, calories, elevation_gain_m, source, external_id)\n"
            + SELECT.format(user_id=user_id) + " from (values\n")
    tail = f"\n) v({', '.join(COLUMNS)})\non conflict (user_id, source, external_id) do nothing;"
    statements = []
    for start in range(0, len(rows), batch):
        statements.append(head + ",\n".join(rows[start:start + batch]) + tail)
    return statements


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--user-id", required=True)
    parser.add_argument("--performance")
    parser.add_argument("--out", help="SQL을 쓸 파일 (없으면 화면에 출력)")
    parser.add_argument("pages", nargs="+")
    args = parser.parse_args()

    performance = None
    if args.performance:
        performance = json.loads(Path(args.performance).read_text(encoding="utf-8"))
    activities = load_activities(args.pages)
    sql = "\n\n".join(build_sql(args.user_id, activities, performance))

    if args.out:
        Path(args.out).write_text(sql, encoding="utf-8")
        print(f"활동 {len(activities)}개 → {args.out}")
    else:
        print(sql)


if __name__ == "__main__":
    main()
