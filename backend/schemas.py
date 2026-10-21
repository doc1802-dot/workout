"""입력 검증. cli/inputs.py 의 '올바를 때까지 다시 묻기'를 Pydantic 규칙으로 바꾼 것."""
import datetime as dt
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator

Sport = Literal["러닝", "바이크", "하이킹", "걷기", "수영", "기타"]


class WorkoutCreate(BaseModel):
    date: dt.date
    sport: Sport
    distance_km: float = Field(ge=0.1, le=10000)        # 0은 나눗셈 오류 방지
    duration_sec: int = Field(ge=1, le=7 * 24 * 3600)
    avg_hr: Optional[int] = Field(default=None, ge=0, le=300)
    max_hr: Optional[int] = Field(default=None, ge=0, le=300)
    avg_cad: Optional[int] = Field(default=None, ge=0, le=400)
    max_cad: Optional[int] = Field(default=None, ge=0, le=400)
    calories: Optional[int] = Field(default=None, ge=0, le=100000)
    memo: str = Field(default="", max_length=1000)
    # 라이브 기록에서 함께 보내는 값
    name: Optional[str] = Field(default=None, max_length=200)
    polyline: Optional[str] = Field(default=None, max_length=200000)
    elevation_gain_m: Optional[float] = Field(default=None, ge=0, le=20000)
    started_at: Optional[dt.datetime] = None


class WorkoutUpdate(BaseModel):
    date: Optional[dt.date] = None
    sport: Optional[Sport] = None
    distance_km: Optional[float] = Field(default=None, ge=0.1, le=10000)
    duration_sec: Optional[int] = Field(default=None, ge=1, le=7 * 24 * 3600)
    avg_hr: Optional[int] = Field(default=None, ge=0, le=300)
    max_hr: Optional[int] = Field(default=None, ge=0, le=300)
    avg_cad: Optional[int] = Field(default=None, ge=0, le=400)
    max_cad: Optional[int] = Field(default=None, ge=0, le=400)
    calories: Optional[int] = Field(default=None, ge=0, le=100000)
    memo: Optional[str] = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def required_fields_not_null(self):
        """날짜/종목/거리/시간/메모는 '안 보냄'은 되지만 null로 지울 수는 없다."""
        for name in ("date", "sport", "distance_km", "duration_sec", "memo"):
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError(f"{name}은(는) 비울 수 없습니다.")
        return self


class StravaExchange(BaseModel):
    code: str = Field(min_length=1, max_length=200)
    state: str = Field(min_length=1, max_length=300)
    scope: Optional[str] = Field(default=None, max_length=200)    # 사용자가 실제로 허용한 권한


class TrackPoint(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    time: dt.datetime
    ele: Optional[float] = Field(default=None, ge=-500, le=9000)


class StravaUpload(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    sport: Sport
    description: str = Field(default="", max_length=2000)
    points: list[TrackPoint] = Field(min_length=2, max_length=50000)
