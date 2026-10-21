# 운동기록 API 계약 (FastAPI)

모든 경로는 `/api`로 시작한다. `/api/health`를 빼면 모두 로그인이 필요하다.
요청 헤더: `Authorization: Bearer <Supabase access_token>` (supabase-js `session.access_token`).
오류 응답: `{"detail": "메시지"}` (401 = 로그인 필요, 404 = 없음, 422 = 입력 오류, 400/502 = 기타)

## 종목
`["러닝", "바이크", "하이킹", "걷기", "수영", "기타"]`

## Workout 객체
```json
{
  "id": "uuid",
  "date": "2026-10-16",
  "sport": "러닝",
  "name": "Morning Run",          // null 가능 (Strava 활동 이름)
  "distance_km": 3.92,
  "duration_sec": 1800,
  "avg_hr": 159, "max_hr": 183,   // null 가능 (모르면 null)
  "avg_cad": 159, "max_cad": 180, // null 가능
  "calories": 415,                // null 가능
  "elevation_gain_m": 12.0,       // null 가능
  "memo": "",
  "source": "manual",             // manual | strava | csv
  "external_id": null,            // Strava 활동 id 등
  "summary": "평균페이스: 7분 39초 /km",  // 바이크는 "평균속도: 20.0 km/h", 거리 0이면 "시간: 30분 0초"
  "cadence_unit": "spm"           // 바이크 rpm, 그 외 spm
}
```

## 기록
| 메서드 | 경로 | 요청 | 응답 |
|---|---|---|---|
| GET | `/api/workouts?sport=러닝&date_from=2026-10-01&date_to=2026-10-31` (모두 선택) | - | `Workout[]` (날짜 최신순) |
| POST | `/api/workouts` | `{date, sport, distance_km, duration_sec, avg_hr?, max_hr?, avg_cad?, max_cad?, calories?, memo?}` | `Workout` (201) |
| PATCH | `/api/workouts/{id}` | 위 필드 중 바꿀 것만 | `Workout` |
| DELETE | `/api/workouts/{id}` | - | 204 |

입력 규칙: `distance_km >= 0.1`(직접 입력 시), `duration_sec >= 1`, 심박/케이던스/칼로리는 0 이상 정수 또는 null.

## 통계
- GET `/api/stats/total` → `{"count": 5, "distance_km": 27.4, "duration_sec": 9000, "calories": 2100, "by_sport": {"러닝": 19.4, "바이크": 8.0}}`
- GET `/api/stats/monthly` → `[{"month": "2026-09", "count": 2, "distance_km": 10.0, "by_sport": {"러닝": 10.0}}, ...]` (월 오름차순)
- GET `/api/stats/pr` → `{"best_run": Workout|null, "best_bike": Workout|null, "longest": Workout|null}`

## CSV 가져오기 (예전 콘솔 프로그램의 records.csv)
- POST `/api/import/csv` (multipart, 필드명 `file`) → `{"imported": 4, "skipped": 0}`

## Strava 연동
- GET `/api/strava/status` → `{"connected": true, "athlete_id": 89111941, "athlete_name": "덕환 김", "last_synced_at": "2026-10-21T01:00:00+00:00" | null, "configured": true}`
  - `configured=false`면 서버에 Strava 앱 키가 없다는 뜻 → 연결 버튼 비활성화 + 안내 문구
- GET `/api/strava/authorize-url?redirect_uri=<origin>/strava/callback` → `{"url": "https://www.strava.com/oauth/authorize?..."}`
  - 프론트는 이 url로 `window.location` 이동. Strava가 `<origin>/strava/callback?code=...&scope=...`로 돌려보낸다 (거부 시 `?error=access_denied`).
- POST `/api/strava/exchange` `{"code": "...", "state": "..."}` → status 객체 (code와 state는 콜백 주소의 쿼리값 그대로)
- POST `/api/strava/sync` → `{"fetched": 30, "imported": 28, "has_more": false, "last_synced_at": "..."}` (새 활동만 추가, 이미 있는 건 건너뜀. has_more=true면 한 번 더 누르면 이어서 가져옴)
- DELETE `/api/strava/connection` → 204 (연결 해제)
