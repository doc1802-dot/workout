"""합계 / 월별 합계 / 개인 최고기록.

cli/features.py 의 show_total, show_monthly, show_pr 에서
print 부분을 빼고 '계산 결과(dict)'를 돌려주게 바꾼 것이다.
"""
import calendar


def total_stats(workouts):
    total_km = 0.0
    total_sec = 0
    total_cal = 0
    by_sport = {}                                # {"러닝": 19.4, "바이크": 8.0}

    for w in workouts:
        total_km += w.distance_km                # 누적 합계
        total_sec += w.duration_sec
        total_cal += w.calories or 0             # 모르는 칼로리(None)는 0으로
        by_sport[w.sport] = by_sport.get(w.sport, 0.0) + w.distance_km

    return {
        "count": len(workouts),
        "distance_km": round(total_km, 2),
        "duration_sec": total_sec,
        "calories": total_cal,
        "by_sport": {sport: round(km, 2) for sport, km in by_sport.items()},
    }


def monthly_stats(workouts):
    monthly = {}                                 # {"2026-10": {...}, ...}
    for w in workouts:
        month = w.date[:7]                       # "2026-10-12"[:7] → "2026-10"
        if month not in monthly:                 # 칸이 없으면 먼저 만든다
            monthly[month] = {"month": month, "count": 0, "distance_km": 0.0, "by_sport": {}}
        m = monthly[month]
        m["count"] += 1
        m["distance_km"] += w.distance_km
        m["by_sport"][w.sport] = m["by_sport"].get(w.sport, 0.0) + w.distance_km

    result = []
    for month in sorted(monthly):                # 월 순서대로
        m = monthly[month]
        m["distance_km"] = round(m["distance_km"], 2)
        m["by_sport"] = {sport: round(km, 2) for sport, km in m["by_sport"].items()}
        result.append(m)
    return result


def personal_records(workouts):
    best_run = None          # None = "아직 없음"
    best_bike = None
    longest = None

    for w in workouts:
        if w.distance_km <= 0:                   # 거리 없는 기록은 비교 대상이 아님
            continue
        if w.sport == "러닝":
            # 페이스는 '작을수록' 빠르다 → < 로 비교
            if best_run is None or w.pace_sec() < best_run.pace_sec():
                best_run = w
        elif w.sport == "바이크":
            # 속도는 '클수록' 빠르다 → > 로 비교
            if best_bike is None or w.speed() > best_bike.speed():
                best_bike = w

        if longest is None or w.distance_km > longest.distance_km:
            longest = w

    return {
        "best_run": best_run.to_api() if best_run else None,
        "best_bike": best_bike.to_api() if best_bike else None,
        "longest": longest.to_api() if longest else None,
    }


# ------------------------------------------------------------------
# 대시보드: 기간(전체/연간/월간) + 종목으로 골라 보기
# ------------------------------------------------------------------
def _empty_bucket(key, label):
    return {"key": key, "label": label, "count": 0, "distance_km": 0.0,
            "duration_sec": 0, "calories": 0, "by_sport": {}}


def _bucket_keys(workouts, year, month):
    """막대그래프 칸: 연도별(전체) / 1~12월(연간) / 1일~말일(월간). 기록이 없는 칸도 0으로 채운다."""
    if year is None:
        years = sorted({int(w.date[:4]) for w in workouts})
        if not years:
            return "year", []
        return "year", [(str(y), f"{y}년") for y in range(years[0], years[-1] + 1)]
    if month is None:
        return "month", [(f"{year}-{m:02d}", f"{m}월") for m in range(1, 13)]
    days = calendar.monthrange(year, month)[1]
    return "day", [(f"{year}-{month:02d}-{d:02d}", f"{d}일") for d in range(1, days + 1)]


def period_stats(workouts, year=None, month=None, sport=None):
    """기간(year, month)과 종목(sport)으로 거른 합계·막대그래프·종목별 요약·최고기록"""
    prefix = "" if year is None else f"{year}" if month is None else f"{year}-{month:02d}"
    in_period = [w for w in workouts if w.date.startswith(prefix)]
    selected = [w for w in in_period if sport is None or w.sport == sport]

    # 종목 탭에 쓰는 요약은 종목으로 거르지 않는다 (다른 종목 탭도 보여야 하니까)
    sports = {}
    for w in in_period:
        s = sports.setdefault(w.sport, {"sport": w.sport, "count": 0, "distance_km": 0.0, "duration_sec": 0})
        s["count"] += 1
        s["distance_km"] += w.distance_km
        s["duration_sec"] += w.duration_sec
    for s in sports.values():
        s["distance_km"] = round(s["distance_km"], 2)

    unit, keys = _bucket_keys(workouts, year, month)
    buckets = {key: _empty_bucket(key, label) for key, label in keys}
    key_len = {"year": 4, "month": 7, "day": 10}[unit]
    for w in selected:
        b = buckets[w.date[:key_len]]
        b["count"] += 1
        b["distance_km"] += w.distance_km
        b["duration_sec"] += w.duration_sec
        b["calories"] += w.calories or 0
        b["by_sport"][w.sport] = b["by_sport"].get(w.sport, 0.0) + w.distance_km
    for b in buckets.values():
        b["distance_km"] = round(b["distance_km"], 2)
        b["by_sport"] = {s: round(km, 2) for s, km in b["by_sport"].items()}

    return {
        "unit": unit,
        "years": sorted({int(w.date[:4]) for w in workouts}),
        "total": total_stats(selected),
        "by_sport": sorted(sports.values(), key=lambda s: (-s["count"], s["sport"])),
        "buckets": list(buckets.values()),
        "pr": personal_records(selected),
    }
