"""합계 / 월별 합계 / 개인 최고기록.

cli/features.py 의 show_total, show_monthly, show_pr 에서
print 부분을 빼고 '계산 결과(dict)'를 돌려주게 바꾼 것이다.
"""


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
