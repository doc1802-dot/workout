"""Vercel 서버리스 함수 진입점. /api/* 요청이 모두 여기로 온다."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.main import app  # noqa: E402,F401
