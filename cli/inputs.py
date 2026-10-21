import datetime as dt

# ------------------------------------------------------------------
# 1. 입력 도우미 함수 (같은 코드를 여러 번 쓰지 않으려고 함수로 분리)
# ------------------------------------------------------------------
def input_int(message, min_value=0):
    """정수를 입력받는다. 잘못 입력하면 올바를 때까지 다시 묻는다."""
    while True:
        try:
            value = int(input(message))
        except ValueError:          # "abc", 빈 입력, "3.5" 등
            print("  ※ 정수로 입력해 주세요.")
            continue
        if value < min_value:
            print(f"  ※ {min_value} 이상이어야 합니다.")
            continue
        return value                # 값을 돌려주며 함수와 while을 함께 끝냄
 
 
def input_float(message, min_value=0.0):
    """실수를 입력받는다. (거리처럼 소수점이 필요한 값)"""
    while True:
        try:
            value = float(input(message))
        except ValueError:
            print("  ※ 숫자로 입력해 주세요.")
            continue
        if value < min_value:
            print(f"  ※ {min_value} 이상이어야 합니다.")
            continue
        return value
 
 
def input_date(message):
    """날짜(YYYY-MM-DD)를 입력받는다. 그냥 엔터를 치면 오늘 날짜."""
    while True:
        text = input(message).strip()
        if text == "":
            return str(dt.date.today())
        try:
            dt.datetime.strptime(text, "%Y-%m-%d")   # 형식이 틀리면 ValueError
        except ValueError:
            print("  ※ 2026-10-12 처럼 입력해 주세요.")
            continue
        return text
 
 
def input_sport(message="종목 (1: 러닝, 2: 바이크): "):
    """종목을 번호로 고르게 한다."""
    while True:
        choice = input(message).strip()
        if choice == "1":
            return "러닝"
        if choice == "2":
            return "바이크"
        print("  ※ 1 또는 2를 입력해 주세요.")
 
 
def cadence_unit(sport):
    """종목에 따른 케이던스 단위. 바이크 = rpm, 러닝 = spm"""
    if sport == "바이크":
        return "rpm"
    return "spm"
 