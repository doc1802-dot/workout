"""예전 콘솔 프로그램의 records.csv 를 Workout 리스트로 바꾼다."""
import csv
import io
import math
from datetime import datetime

from backend.workout import SPORTS, Workout


def _number(text, low, high):
    """유한한 숫자이고 범위 안이어야 한다 (inf, nan, 너무 큰 값은 ValueError)"""
    value = float(text)
    if not math.isfinite(value) or not low <= value <= high:
        raise ValueError(text)
    return value


def _int_or_none(text, high):
    """'0'이나 빈칸은 '모름'(None)으로. 콘솔 프로그램은 모르면 0을 넣었다."""
    text = (text or "").strip()
    if text == "":
        return None
    value = int(_number(text, 0, high))
    return value if value > 0 else None


def parse_csv(data):
    """CSV 바이트 → (Workout 리스트, 건너뛴 줄 수)"""
    text = data.decode("utf-8-sig")
    workouts = []
    skipped = 0
    try:
        rows = list(csv.DictReader(io.StringIO(text)))
    except csv.Error:
        raise ValueError("CSV 형식이 올바르지 않습니다.")
    for row in rows:
        try:
            sport = row["종목"].strip()
            minutes = int(_number(row["시간(분)"], 1, 7 * 24 * 60))     # 일반 입력 API와 같은 범위
            distance = _number(row["거리(km)"], 0, 10000)
            if sport not in SPORTS:
                raise ValueError(sport)
            date = row["날짜"].strip()
            datetime.strptime(date, "%Y-%m-%d")     # 형식이 틀리면 ValueError
            workouts.append(Workout(
                date, sport, distance, minutes * 60,
                _int_or_none(row.get("평균심박"), 300), _int_or_none(row.get("최대심박"), 300),
                _int_or_none(row.get("평균케이던스"), 400), _int_or_none(row.get("최대케이던스"), 400),
                _int_or_none(row.get("칼로리"), 100000), (row.get("메모") or "").strip()[:1000],
                source="csv",
                # 같은 파일을 두 번 올려도 중복 저장되지 않게 만드는 이름표
                external_id=f"{date}|{sport}|{distance}|{minutes}",
            ))
        except (KeyError, ValueError, TypeError, OverflowError, AttributeError):
            skipped += 1
    return workouts, skipped
