"""예전 콘솔 프로그램의 records.csv 를 Workout 리스트로 바꾼다."""
import csv
import io
from datetime import datetime

from backend.workout import SPORTS, Workout


def _int_or_none(text):
    """'0'이나 빈칸은 '모름'(None)으로. 콘솔 프로그램은 모르면 0을 넣었다."""
    text = (text or "").strip()
    if text == "":
        return None
    value = int(float(text))
    return value if value > 0 else None


def parse_csv(data):
    """CSV 바이트 → (Workout 리스트, 건너뛴 줄 수)"""
    text = data.decode("utf-8-sig")
    workouts = []
    skipped = 0
    for row in csv.DictReader(io.StringIO(text)):
        try:
            sport = row["종목"].strip()
            minutes = int(float(row["시간(분)"]))
            distance = float(row["거리(km)"])
            if sport not in SPORTS or minutes < 1 or distance < 0:
                raise ValueError
            date = row["날짜"].strip()
            datetime.strptime(date, "%Y-%m-%d")     # 형식이 틀리면 ValueError
            workouts.append(Workout(
                date, sport, distance, minutes * 60,
                _int_or_none(row.get("평균심박")), _int_or_none(row.get("최대심박")),
                _int_or_none(row.get("평균케이던스")), _int_or_none(row.get("최대케이던스")),
                _int_or_none(row.get("칼로리")), (row.get("메모") or "").strip(),
                source="csv",
                # 같은 파일을 두 번 올려도 중복 저장되지 않게 만드는 이름표
                external_id=f"{date}|{sport}|{distance}|{minutes}",
            ))
        except (KeyError, ValueError, TypeError):
            skipped += 1
    return workouts, skipped
