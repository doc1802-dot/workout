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
- GET `/api/stats/summary?year=2026&month=10&sport=러닝` (모두 선택, month는 year와 함께) → 대시보드용
  - `unit`: 막대 칸 단위. year 없음 → `year`(연도별), year만 → `month`(1~12월), year+month → `day`(그 달 모든 날)
  - `years`: 기록이 있는 연도 (필터 무시)
  - `total`: 기간+종목으로 거른 합계 (`/stats/total`과 같은 모양)
  - `by_sport`: 기간으로만 거른 종목별 `{sport, count, distance_km, duration_sec}` (종목 탭용, 개수 많은 순)
  - `buckets`: `{key, label, count, distance_km, duration_sec, calories, by_sport}` — 기록 없는 칸도 0으로 채움
  - `pr`: 기간+종목으로 거른 최고 기록

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

## PACEHUB 화면용 추가 API (Stitch 디자인 개편)

### Workout 객체에 추가된 필드
`polyline`(Strava 요약 경로, encoded polyline | null), `kudos_count`, `avg_watts`, `max_speed_kmh`, `gear_id` (모두 null 가능)

### 기록 한 건
- GET `/api/workouts/{id}` → Workout (없으면 404)
- POST `/api/workouts` 는 `name`, `polyline`, `elevation_gain_m`, `started_at`(ISO) 도 받는다 (라이브 기록 저장용)

### 활동 상세 (Strava 활동이면 Strava에서 자세히 가져온다)
- GET `/api/workouts/{id}/detail` →
```json
{
  "workout": Workout,
  "strava": null | {
    "activity_id": 123, "url": "https://www.strava.com/activities/123",
    "description": "", "device_name": "Garmin Edge 540",
    "gear": {"id": "b123", "name": "Tarmac", "distance_km": 3420.1} | null,
    "average_speed_kmh": 25.1, "max_speed_kmh": 61.2,
    "average_watts": 180 | null, "max_watts": 620 | null, "weighted_watts": 195 | null, "kilojoules": 900 | null,
    "calories": 680 | null, "suffer_score": 120 | null,
    "elev_high": 512.3 | null, "elev_low": 12.0 | null,
    "kudos_count": 3, "comment_count": 0, "achievement_count": 5, "pr_count": 2, "photo_count": 0,
    "polyline": "encoded…" | null,
    "splits": [{"index": 1, "distance_km": 1.0, "elapsed_sec": 300, "moving_sec": 298, "pace_sec_per_km": 298, "speed_kmh": 12.1, "elevation_diff_m": 3.2, "avg_hr": 150 | null}],
    "laps": [{"index": 1, "name": "Lap 1", "distance_km": 5.0, "elapsed_sec": 1500, "moving_sec": 1490, "speed_kmh": 12.1, "avg_hr": 150 | null, "max_hr": 170 | null, "avg_cad": 170 | null, "avg_watts": null}],
    "segments": [{"id": 1, "name": "남산 업힐", "distance_km": 2.1, "elapsed_sec": 600, "moving_sec": 600, "avg_grade": 5.2, "pr_rank": 1 | null, "kom_rank": null, "avg_hr": 160 | null, "avg_watts": 210 | null}],
    "streams": {
      "distance_km": [...], "time_sec": [...], "altitude_m": [...] | null, "heartrate": [...] | null,
      "speed_kmh": [...] | null, "cadence": [...] | null, "watts": [...] | null, "grade": [...] | null,
      "latlng": [[37.5, 127.0], ...] | null
    } | null
  },
  "strava_error": null | "Strava에 연결되어 있지 않습니다." 등
}
```
- streams 배열은 모두 같은 길이(최대 400개로 줄임). 러닝 케이던스는 ×2(spm).

### Strava 프로필·기어·누적
- GET `/api/strava/profile` (연결 필요, 아니면 400) →
```json
{
  "athlete": {"id": 1, "name": "김덕환", "profile_url": "https://…jpg" | null, "city": "울산", "country": "South Korea", "premium": true, "ftp": 250 | null, "weight": 70.0 | null, "follower_count": 10, "friend_count": 12},
  "gear": {"bikes": [{"id": "b1", "name": "Tarmac", "distance_km": 3420.1, "primary": true}], "shoes": [...]},
  "totals": {"recent_run": T, "recent_ride": T, "ytd_run": T, "ytd_ride": T, "all_run": T, "all_ride": T}
}
```
  T = `{"count": 3, "distance_km": 30.2, "moving_sec": 9000, "elevation_m": 120}` (recent = 최근 4주)

### 세그먼트
- GET `/api/strava/segments` (연결 필요) → `{"segments": [{"id": 1, "name": "…", "activity_type": "Ride", "distance_km": 2.1, "avg_grade": 5.2, "max_grade": 12.0, "elev_high": 300, "elev_low": 190, "climb_category": 3, "city": "울산", "pr_elapsed_sec": 600 | null, "pr_date": "2026-09-01" | null, "effort_count": 12 | null, "url": "https://www.strava.com/segments/1"}]}` (내가 별표한 세그먼트)

### 전체 다시 가져오기 / 업로드
- POST `/api/strava/resync` → 동기화 시작점을 처음으로 되돌린다 (응답 `{"ok": true}`). 이어서 POST `/api/strava/sync?update=true` 를 has_more가 false가 될 때까지 부르면 이미 있는 Strava 기록도 지도·킬로줄 등 새 필드로 갱신된다 (메모는 유지).
- POST `/api/strava/upload` `{"name": "Morning Ride", "sport": "바이크", "description": "", "points": [{"lat": 35.5, "lng": 129.3, "time": "2026-10-21T06:00:00Z", "ele": 12.3}]}` → `{"upload_id": 1, "status": "…", "activity_id": null}`
  - 활동 쓰기 권한(`activity:write`)이 없으면 403 `"Strava 업로드 권한이 없습니다. 연결을 해제하고 다시 연결해 주세요."`
- GET `/api/strava/upload/{upload_id}` → `{"status": "…", "activity_id": 123 | null, "error": null | "…"}`
- POST `/api/strava/exchange` 는 `scope`(콜백 주소의 scope 값)도 받는다. `/api/strava/status` 응답에 `can_upload`(bool) 추가.

### 수동 기록 → Strava, 웹훅
- POST `/api/workouts/{id}/strava` → 앱 기록을 Strava 수동 활동으로 만들고 `source='strava'`, `external_id`로 연결한 Workout 반환
  - 403 업로드 권한 없음, 409 이미 Strava 기록
- GET `/api/strava/webhook?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…` → `{"hub.challenge": "…"}` (구독 확인)
- POST `/api/strava/webhook` (Strava가 호출) → `{"ok": true}`. 활동 create/update는 다시 조회해 저장, delete는 Strava 404일 때만 삭제, 선수 권한 해제 시 연결 삭제
- `workout_id`는 UUID만 받는다 (아니면 422). `/api/strava/authorize-url`의 redirect_uri는 허용된 주소의 `/strava/callback`만.
