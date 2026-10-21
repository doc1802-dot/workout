# PACEHUB — 나의 운동 텔레메트리 허브

> 러닝·라이딩 기록을 한곳에 모아 **기록하고, 분석하고, 다시 보는** 개인 운동 웹사이트

- 사이트: https://workout-eight-gamma.vercel.app
- 저장소: https://github.com/doc1802-dot/workout

## 왜 만들었나 (목적)

운동 기록이 Strava, 가민·삼성헬스, 손으로 적은 CSV처럼 여러 곳에 흩어져 있으면
"이번 달에 얼마나 탔지?", "작년보다 빨라졌나?" 같은 질문에 바로 답하기 어렵다.

PACEHUB는
1. **모으기** — Strava 계정을 연결하면 내 활동이 자동으로 들어오고, 직접 입력·CSV 가져오기도 된다.
2. **보기** — 피드·지도·고도 그래프·구간(스플릿) 기록으로 한 번의 운동을 자세히 본다.
3. **비교하기** — 연간/월간/종목별 통계, 개인 최고기록, 월 목표, 히트맵으로 흐름을 본다.
4. **기록하기** — 휴대폰 브라우저로 GPS 라이브 기록을 하고, 끝나면 Strava에 바로 올린다.

처음에는 콘솔에서 CSV에 기록을 저장하던 Python 프로그램(`cli/`)이었고,
그 `Workout` 클래스와 통계 계산을 그대로 웹 서버로 옮겨 키웠다.

## 주요 기능

| 화면 | 주소 | 내용 |
|---|---|---|
| 피드 | `/` | 최신 활동 카드(지도·거리·시간·페이스/속도·심박), 이번 주 요약, 이번 달 종목별 거리, 최고 기록 |
| 활동 분석 | `/analytics` | 전체/연간/월간 + 종목 필터 통계, 접이식 기간별 기록(최신순), 개인 최고기록 |
| 활동 상세 | `/activities/:id` | 경로 지도, 고도·경사 그래프(지도와 연동), 심박/속도/케이던스/파워 그래프, 1km 스플릿, 랩, 세그먼트 |
| 라이브 HUD | `/live` | 휴대폰 GPS 실시간 기록, 랩, 자동 일시정지, 블루투스 심박계, 앱 종료 후 이어하기, Strava 업로드 / GPX 내보내기 |
| 기어 & 통계 | `/gear` | Strava 프로필, 누적 거리(최근 4주·올해·전체), 월 목표, 활동 히트맵, 기어 마일리지, 배지 |
| 세그먼트 | `/segments` | Strava에서 별표한 세그먼트와 내 PR |
| 기록 관리 | `/workouts` | 기록 표 · 추가 · 수정 · 삭제 |
| 연동 설정 | `/settings` | Strava 연결/동기화/전체 다시 가져오기, CSV 가져오기 |

사용자마다 따로 가입하고 각자 Strava를 연결하며, DB 보안 정책(RLS)으로 **자기 기록만** 보인다.

## 구조

```
 사용자 브라우저 (PC / 휴대폰)
        │
        ▼
 ┌──────────────────────── Vercel ────────────────────────┐
 │  화면  React SPA (frontend/dist)                         │
 │  API   /api/*  →  FastAPI (Python 서버리스 함수, 서울)      │
 └───────────┬──────────────────────────────┬─────────────┘
             │ 사용자 토큰으로 접근             │ OAuth 토큰
             ▼                              ▼
   Supabase (서울)                     Strava API
   · Postgres: workouts,              · 활동 목록·상세·그래프
     strava_connections               · 프로필·기어·세그먼트
   · Auth: 이메일 로그인                 · GPX 업로드
   · RLS: 본인 데이터만
```

| 구분 | 언어 / 기술 | 위치 |
|---|---|---|
| 화면 | JavaScript(JSX) · React 19 · Vite 6 · react-router 7 · Tailwind CSS 3 · Leaflet(OpenStreetMap) · SVG 그래프 | `frontend/` |
| 디자인 | Google Stitch "Workout Log & Share" (PACEHUB 다크 테마) | `design/stitch/` |
| API | Python 3.12 · FastAPI · httpx · Pydantic | `backend/`, 진입점 `api/index.py` |
| DB · 로그인 | Supabase (Postgres + Auth + RLS), Supabase CLI 마이그레이션 | `supabase/migrations/` |
| 외부 연동 | Strava API (OAuth, 활동·stream·세그먼트·업로드), Strava MCP(Claude Code용) | `backend/strava*.py` |
| 배포 · 협업 | Vercel, GitHub (PR 단위 병합) | `vercel.json` |
| 테스트 | pytest(백엔드), ESLint·Vite build(화면) | `tests/` |
| 시작점 | 콘솔 운동 기록 프로그램 (CSV 저장) | `cli/` |

백엔드 파일:

| 파일 | 역할 |
|---|---|
| `main.py` | API 주소 정의 |
| `workout.py`, `stats.py` | 운동 기록 클래스, 합계·월별·기간·최고기록 계산 (콘솔 프로그램에서 옮김) |
| `db.py`, `auth.py` | Supabase 읽기/쓰기, 로그인 토큰 확인 |
| `strava.py`, `strava_detail.py` | Strava 통신, 응답 정리·GPX 생성 |
| `strava_mcp.py`, `csv_import.py` | Strava MCP 데이터·예전 CSV 변환 |

API 명세는 [docs/API.md](docs/API.md).

## 로컬 실행

```bash
# 1) 백엔드
cp .env.example .env          # 값 채우기
pip install -r requirements-dev.txt
python -m uvicorn backend.main:app --reload --port 8000

# 2) 화면 (다른 터미널) — /api 요청은 8000번으로 프록시됨
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

`frontend/.env.local`에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`가 필요하다.

## 테스트

```bash
python -m pytest -q           # cli/ + tests/
cd frontend && npm run lint && npm run build
```

## 환경변수 (Vercel)

| 이름 | 용도 |
|---|---|
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | 백엔드 → Supabase |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | 화면 빌드 시 로그인용 |
| `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET` | Strava 연동 (https://www.strava.com/settings/api) |
| `STRAVA_WEBHOOK_SECRET` | 웹훅 DB 함수 비밀값 (DB에는 해시만) |
| `STRAVA_WEBHOOK_VERIFY_TOKEN`, `STRAVA_WEBHOOK_SUBSCRIPTION_ID` | Strava 웹훅 구독 확인·검증 |
| `ALLOWED_ORIGINS` (선택) | Strava 연결 후 돌아올 수 있는 화면 주소 목록 |

## DB 변경

```bash
npx supabase migration new <이름>   # supabase/migrations/ 에 SQL 작성
npx supabase db push                # 연결된 프로젝트에 적용 (supabase login, link 필요)
```

## Strava 연동 흐름

1. 연동 화면에서 "Strava 연결" → Strava 승인 화면 → `/strava/callback`
2. 서버가 code를 토큰으로 바꿔 `strava_connections`에 저장 (state 서명으로 본인 확인)
3. "지금 동기화" → 마지막으로 가져온 활동 이후 것만 받아 `workouts`에 추가 (같은 활동은 중복 저장 안 됨)
   - "전체 다시 가져오기" → 시작점을 처음으로 되돌리고 기존 기록도 갱신 (지도·응원 수 등, 메모는 유지)
   - 라이브 기록 업로드에는 `activity:write` 권한이 필요하다 (연결할 때 함께 요청)
4. 앱에서 입력한 기록 → "Strava에도 올리기"(입력 창) 또는 활동 상세의 "Strava에 올리기" → Strava 수동 활동으로 만들고 그 활동과 연결
5. **웹훅 자동 동기화**: Strava에서 활동이 생기거나 바뀌거나 지워지면 `POST /api/strava/webhook`으로 몇 초 안에 반영
   - 웹훅에는 서명이 없으므로 이벤트 내용을 믿지 않고 항상 그 선수의 토큰으로 Strava를 다시 조회한다 (삭제는 Strava가 404일 때만)
   - 로그인 사용자가 없는 요청이라, 서버에 모든 권한 키를 두지 않고 DB 함수 `strava_webhook_*`(비밀값 확인, SECURITY DEFINER)만 쓴다.
     비밀값 원문은 Vercel 환경변수에만 있고 DB에는 SHA-256 해시만 있다. (Supabase 보안 점검의 "anon이 실행 가능한 SECURITY DEFINER" 경고는 이 의도된 설계)
4. 러닝 케이던스는 Strava의 한 발 기준 값을 ×2 해서 spm으로 저장. 목록 API에 없는 칼로리·최대 케이던스는 비워 둔다.

## Strava MCP 동기화 (Claude Code)

Strava API 앱 키 없이도, Claude Code에서 `/strava-sync`를 실행하면 Claude가 Strava MCP로 활동을 읽어 `workouts`에 넣는다.

- 절차: `.claude/skills/strava-sync/SKILL.md`
- 변환: `backend/strava_mcp.py` (MCP 형식 → Workout, 이름의 제어문자 제거, 칼로리 포함)
- SQL 생성: `python scripts/strava_mcp_sync.py --user-id <uuid> --out sync.sql page*.json`
- 위 REST 동기화와 `source='strava'`, `external_id`가 같아서 두 방식을 섞어도 중복되지 않는다.
- MCP 목록에는 심박이 없어서, 새 활동이 적을 때만 `get_activity_performance`로 심박을 채운다.
