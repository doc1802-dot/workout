class Workout:
    def __init__(self, date, sport, distance, minutes,
                 avg_hr, max_hr, avg_cad, max_cad, calories, memo):
        self.date = date
        self.sport = sport
        self.distance = float(distance)      # 만들 때 한 번만 변환!
        self.minutes = int(minutes)
        self.avg_hr = int(avg_hr)
        self.max_hr = int(max_hr)
        self.avg_cad = int(avg_cad)
        self.max_cad = int(max_cad)
        self.calories = int(calories)
        self.memo = memo

    def speed(self):
        """평균속도 km/h (숫자)"""
        return self.distance / (self.minutes / 60)

    def pace_sec(self):
        """1km당 초 (숫자)"""
        return self.minutes * 60 / self.distance

    def cadence_unit(self):
        if self.sport == "바이크":
            return "rpm"
        return "spm"

    def summary(self):
        """바이크면 평균속도, 러닝이면 평균페이스 문자열"""
        if self.sport == "바이크":
            return f"평균속도: {self.speed():.1f} km/h"
        total_sec = round(self.pace_sec())
        minute, second = divmod(total_sec,60)
        return f"평균페이스: {minute}분 {second:02d}초 /km" 
    
    def to_row(self):
        """Workout  객체를 CSV 한 줄 (딕셔너리)로 바꾼다"""
        return{
            "날짜": self.date,
            "종목": self.sport,
            "거리(km)": self.distance,
            "시간(분)": self.minutes,
            "평균심박": self.avg_hr,
            "최대심박": self.max_hr,
            "평균케이던스": self.avg_cad,
            "최대케이던스": self.max_cad,
            "칼로리": self.calories, 
            "메모": self.memo,
        }
    

def from_row(row):
    """CSV 한 줄(딕셔너리)을 workout 객체로 만든다."""
    return Workout(
        row["날짜"], row["종목"], row["거리(km)"], row["시간(분)"],
        row["평균심박"], row["최대심박"], row["평균케이던스"], row["최대케이던스"],
        row["칼로리"], row["메모"],
    )

