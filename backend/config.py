import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _load_dotenv(path):
    """로컬 개발용: 프로젝트 루트의 .env 파일(KEY=VALUE)을 환경변수로 읽는다.
    이미 설정된 환경변수(Vercel 등)는 덮어쓰지 않는다."""
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line == "" or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())


_load_dotenv(os.path.join(ROOT, ".env"))


def _env(name):
    return os.environ.get(name, "").strip()


SUPABASE_URL = _env("SUPABASE_URL").rstrip("/")
SUPABASE_PUBLISHABLE_KEY = _env("SUPABASE_PUBLISHABLE_KEY")

STRAVA_CLIENT_ID = _env("STRAVA_CLIENT_ID")
STRAVA_CLIENT_SECRET = _env("STRAVA_CLIENT_SECRET")


# Strava 웹훅 (자동 동기화)
STRAVA_WEBHOOK_SECRET = _env("STRAVA_WEBHOOK_SECRET")            # DB 웹훅 함수 비밀값
STRAVA_WEBHOOK_VERIFY_TOKEN = _env("STRAVA_WEBHOOK_VERIFY_TOKEN")  # Strava 구독 확인용
STRAVA_WEBHOOK_SUBSCRIPTION_ID = _env("STRAVA_WEBHOOK_SUBSCRIPTION_ID")

# Strava 연결 후 돌아올 수 있는 화면 주소 (정확히 일치해야 함)
ALLOWED_ORIGINS = [o.rstrip("/") for o in (
    _env("ALLOWED_ORIGINS")
    or "https://workout-eight-gamma.vercel.app,https://workout-deokhwan.vercel.app,"
       "http://localhost:5173,http://127.0.0.1:5173"
).split(",") if o.strip()]


def strava_configured():
    return bool(STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET)
