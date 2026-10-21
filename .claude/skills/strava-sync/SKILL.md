---
name: strava-sync
description: Strava MCP로 사용자의 Strava 활동을 가져와 운동기록 웹사이트(Supabase workouts 테이블)에 동기화한다. "strava 동기화", "/strava-sync", "스트라바 기록 가져와" 요청 때 사용.
---

# Strava MCP → 웹사이트 동기화

Strava MCP는 Claude만 쓸 수 있는 읽기 전용 도구라, Claude가 활동을 받아 DB에 넣는다.
REST 동기화(사이트의 "지금 동기화")와 `source='strava'`, `external_id=활동 id`가 같아서 두 방식이 섞여도 중복되지 않는다.

- Supabase 프로젝트: `bxisymnqxbtkoaoovtsq` (workout-log)
- 변환 규칙: `backend/strava_mcp.py`, SQL 생성: `scripts/strava_mcp_sync.py`

## 순서

1. **대상 계정**: 인자로 이메일을 받으면 그 계정, 없으면 `doc1802@gmail.com`.
   ```sql
   select id from auth.users where email = '<email>';
   select max(date) from public.workouts where user_id = '<id>' and source = 'strava';
   ```
   계정이 없으면 사이트에서 먼저 가입하라고 안내하고 멈춘다.

2. **활동 가져오기**: `list_activities`를 `ordering: StartDateLocalAsc`, `first: 100`으로 부르고
   `has_next_page`가 false가 될 때까지 `after: end_cursor`로 넘긴다.
   위 max(date)가 있으면 `range_start: "<그 날짜>T00:00:00"`을 줘서 그 이후만 받는다(그날 것은 중복이라 무시됨).

3. **파일로 저장**: 100개 페이지는 결과가 커서 Claude Code가 `tool-results/mcp-claude_ai_Strava-list_activities-*.txt`로
   저장해 준다. 이 파일은 list_activities JSON 그대로라 **스크립트에 바로 넘긴다**(다시 옮겨 적지 않는다).
   다음 커서는 `python -c "import json;print(json.load(open(파일,encoding='utf-8'))['end_cursor'])"`로 읽는다.
   결과가 작아 화면에 바로 나온 페이지만 필요한 필드(`id, name, sport_type, start_local, summary{...}`)로 json 파일을 만든다.

4. **심박(선택)**: 새 활동이 20개 이하이면 각 활동에 `get_activity_performance`를 불러
   `{"<id>": {"has_heartrate", "average_heartrate", "max_heartrate", "calories"}}`를 `perf.json`으로 저장한다.
   그보다 많으면 심박 없이 넣고 그렇게 보고한다.

5. **SQL 만들기**:
   ```
   python scripts/strava_mcp_sync.py --user-id <id> [--performance perf.json] --out sync.sql page*.json
   ```
   SQL은 200행씩 나뉜 insert 문(빈 줄로 구분)이다. 각 문을 Supabase MCP `execute_sql`로 실행한다.
   `returning`은 붙이지 않는다(결과가 커질 뿐).

6. **확인 후 보고**: 가져온 활동 수, 새로 들어간 수(실행 전후 `count(*) where source='strava'` 차이), 종목별 개수.
