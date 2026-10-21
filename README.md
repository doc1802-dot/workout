# 운동기록

러닝·바이크 운동 기록을 입력하고 보는 웹사이트. Strava 활동을 가져와 동기화할 수 있다.

- 화면: React (Vite) — `frontend/`
- API: FastAPI — `backend/` (Vercel 진입점 `api/index.py`)
- DB / 로그인: Supabase (Postgres + Auth, RLS로 본인 기록만 접근) — `supabase/migrations/`
- 배포: Vercel (화면 + `/api/*` 서버리스 함수)
- 예전 콘솔 프로그램: `cli/` (`cli/run.bat`, CSV 저장 그대로 동작)

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

## DB 변경

```bash
npx supabase migration new <이름>   # supabase/migrations/ 에 SQL 작성
npx supabase db push                # 연결된 프로젝트에 적용 (supabase login, link 필요)
```

## Strava 연동 흐름

1. 연동 화면에서 "Strava 연결" → Strava 승인 화면 → `/strava/callback`
2. 서버가 code를 토큰으로 바꿔 `strava_connections`에 저장 (state 서명으로 본인 확인)
3. "지금 동기화" → 마지막으로 가져온 활동 이후 것만 받아 `workouts`에 추가 (같은 활동은 중복 저장 안 됨)
4. 러닝 케이던스는 Strava의 한 발 기준 값을 ×2 해서 spm으로 저장. 목록 API에 없는 칼로리·최대 케이던스는 비워 둔다.
