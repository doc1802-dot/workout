# ------------------------------------------------------------------
# 2. 계산 함수: 계산만 하고, 화면 배치(들여쓰기 등)는 출력하는 쪽에서 한다
# ------------------------------------------------------------------
def get_speed(record):
    """평균속도(km/h)를 '숫자'로 돌려준다. (비교/계산용)"""
    distance = float(record["거리(km)"])
    minutes = int(record["시간(분)"])
    return distance / (minutes / 60)        # 분 → 시간은 / 60
 
 
def get_pace_sec(record):
    """1km당 페이스를 '초'(숫자)로 돌려준다. 작을수록 빠르다."""
    distance = float(record["거리(km)"])
    minutes = int(record["시간(분)"])
    return minutes * 60 / distance
 
 
def calc_pace_or_speed(record):
    """보기 좋은 문자열로 돌려준다. 바이크=속도, 러닝=페이스"""
    if record["종목"] == "바이크":
        return f"평균속도: {get_speed(record):.1f} km/h"
    total_sec = round(get_pace_sec(record))     # 정수로 만들어야 :02d 사용 가능
    minute, second = divmod(total_sec, 60)      # 몫과 나머지를 한 번에
    return f"평균페이스: {minute}분 {second:02d}초 /km"
 
 