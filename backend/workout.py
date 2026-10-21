"""운동 기록 한 건을 나타내는 Workout 클래스.

cli/workout.py 의 Workout을 웹용으로 넓힌 것이다.
  - 시간은 분 대신 초(duration_sec)로 저장한다. (Strava 기록은 초 단위)
  - 모르는 심박/케이던스/칼로리는 0 대신 None으로 둔다. (평균 계산에 섞이지 않게)
  - CSV 한 줄 대신 DB 한 행(dict)으로 바꾼다: to_db() / from_db()
"""

SPORTS = ["러닝", "바이크", "하이킹", "걷기", "수영", "기타"]


class Workout:
    def __init__(self, date, sport, distance_km, duration_sec,
                 avg_hr=None, max_hr=None, avg_cad=None, max_cad=None,
                 calories=None, memo="", *, id=None, name=None,
                 elevation_gain_m=None, started_at=None,
                 source="manual", external_id=None,
                 polyline=None, kudos_count=None, avg_watts=None,
                 max_speed_kmh=None, gear_id=None):
        self.id = id
        self.date = str(date)
        self.sport = sport
        self.distance_km = float(distance_km)    # 만들 때 한 번만 변환!
        self.duration_sec = int(duration_sec)
        self.avg_hr = avg_hr
        self.max_hr = max_hr
        self.avg_cad = avg_cad
        self.max_cad = max_cad
        self.calories = calories
        self.memo = memo or ""
        self.name = name
        self.elevation_gain_m = elevation_gain_m
        self.started_at = started_at
        self.source = source
        self.external_id = external_id
        self.polyline = polyline              # 지도용 경로 (Strava 요약 경로, encoded polyline)
        self.kudos_count = kudos_count
        self.avg_watts = avg_watts
        self.max_speed_kmh = max_speed_kmh
        self.gear_id = gear_id

    def speed(self):
        """평균속도 km/h (숫자)"""
        return self.distance_km / (self.duration_sec / 3600)

    def pace_sec(self):
        """1km당 초 (숫자). 작을수록 빠르다."""
        return self.duration_sec / self.distance_km

    def cadence_unit(self):
        if self.sport == "바이크":
            return "rpm"
        return "spm"

    def summary(self):
        """바이크면 평균속도, 나머지는 평균페이스 문자열. 거리가 없으면 시간만."""
        if self.distance_km <= 0:
            minute, second = divmod(self.duration_sec, 60)
            return f"시간: {minute}분 {second}초"
        if self.sport == "바이크":
            return f"평균속도: {self.speed():.1f} km/h"
        total_sec = round(self.pace_sec())
        minute, second = divmod(total_sec, 60)
        return f"평균페이스: {minute}분 {second:02d}초 /km"

    def to_db(self):
        """DB에 넣을 dict (id, user_id는 DB가 채운다)"""
        return {
            "date": self.date,
            "started_at": self.started_at,
            "sport": self.sport,
            "name": self.name,
            "distance_km": round(self.distance_km, 2),
            "duration_sec": self.duration_sec,
            "avg_hr": self.avg_hr,
            "max_hr": self.max_hr,
            "avg_cad": self.avg_cad,
            "max_cad": self.max_cad,
            "calories": self.calories,
            "elevation_gain_m": self.elevation_gain_m,
            "memo": self.memo,
            "source": self.source,
            "external_id": self.external_id,
            "polyline": self.polyline,
            "kudos_count": self.kudos_count,
            "avg_watts": self.avg_watts,
            "max_speed_kmh": self.max_speed_kmh,
            "gear_id": self.gear_id,
        }

    def to_api(self):
        """화면에 보낼 dict = DB 값 + 계산 결과"""
        data = self.to_db()
        data["id"] = self.id
        data["summary"] = self.summary()
        data["cadence_unit"] = self.cadence_unit()
        return data


def from_db(row):
    """DB 한 행(dict)을 Workout 객체로 만든다."""
    return Workout(
        row["date"], row["sport"], row["distance_km"], row["duration_sec"],
        row.get("avg_hr"), row.get("max_hr"), row.get("avg_cad"), row.get("max_cad"),
        row.get("calories"), row.get("memo", ""),
        id=row.get("id"),
        name=row.get("name"),
        elevation_gain_m=row.get("elevation_gain_m"),
        started_at=row.get("started_at"),
        source=row.get("source", "manual"),
        external_id=row.get("external_id"),
        polyline=row.get("polyline"),
        kudos_count=row.get("kudos_count"),
        avg_watts=row.get("avg_watts"),
        max_speed_kmh=row.get("max_speed_kmh"),
        gear_id=row.get("gear_id"),
    )
