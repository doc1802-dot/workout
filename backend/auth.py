"""요청 헤더의 Supabase 토큰으로 '누가 요청했는지' 확인한다."""
from dataclasses import dataclass

import httpx
from fastapi import Header, HTTPException

from backend import config


@dataclass
class User:
    id: str
    email: str
    token: str


def current_user(authorization: str = Header(default="")):
    """FastAPI 의존성: 로그인한 사용자를 돌려주고, 아니면 401."""
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or token == "":
        raise HTTPException(401, "로그인이 필요합니다.")

    # Supabase Auth에 토큰을 보여주고 사용자 정보를 받는다 (서명/만료 검사는 Supabase가 함)
    res = httpx.get(f"{config.SUPABASE_URL}/auth/v1/user", timeout=10, headers={
        "apikey": config.SUPABASE_PUBLISHABLE_KEY,
        "Authorization": f"Bearer {token}",
    })
    if res.status_code != 200:
        raise HTTPException(401, "로그인이 만료되었습니다. 다시 로그인해 주세요.")
    data = res.json()
    return User(id=data["id"], email=data.get("email", ""), token=token)
