import os
from storage import FILE, FIELDS, load_records, save_record, save_all_records
from storage import load_workouts, save_workout, save_all_workouts
from workout import Workout, from_row
from inputs import input_int, input_float, input_date, input_sport, cadence_unit

# ------------------------------------------------------------------
# 4. 메뉴 1: 기록 추가
# ------------------------------------------------------------------
def add_record():
    print("\n[기록 추가]  (날짜는 엔터만 치면 오늘)")
    workouts = []
    date = input_date("날짜 (YYYY-MM-DD): ")
    sport = input_sport()
    unit = cadence_unit(sport)
    
    workouts = Workout(
        date,
        sport,
        input_float("거리(km): ", 0.1),     # 0은 나눗셈 오류 방지
        input_int("시간(분): ", 1),
        input_int("평균 심박수(bpm, 모르면 0): "),
        input_int("최대 심박수(bpm, 모르면 0): "),
        input_int(f"평균 케이던스({unit}, 모르면 0): "),
        input_int(f"최대 케이던스({unit}, 모르면 0): "),
        input_int("칼로리(kcal, 모르면 0): "),
        input("메모: ").strip(),
    )
    save_workout(workouts)
    print("\n저장 완료!  " + workouts.summary())
 
 
# ------------------------------------------------------------------
# 5. 메뉴 2: 기록 보기
# ------------------------------------------------------------------
def show_records():
    workouts = load_workouts()
    
    if len(workouts) == 0:
        print("\n저장된 기록이 없습니다.")
        return                                   # 값 없는 return: 여기서 함수 끝
 
    print(f"\n[전체 기록]  총 {len(workouts)}개")
    for i, w in enumerate(workouts, start=1):     # 화면 번호는 1부터
        print(f"{i}. {w.date}  {w.sport}  {w.distance}km  {w.minutes}분")
        print("     " + w.summary())   # 들여쓰기는 출력하는 쪽에서
        print(f"     심박 {w.avg_hr}/{w.max_hr}bpm  "
              f"케이던스 {w.avg_cad}/{w.max_cad}{w.cadence_unit()}  "
              f"{w.calories}kcal")
        if w.memo != "":
            print(f"     메모: {w.memo}")
 
 
# ------------------------------------------------------------------
# 6. 메뉴 3: 합계 (전체 + 종목별)
# ------------------------------------------------------------------
def show_total():
    workouts = load_workouts()
    if len(workouts) == 0:
        print("\n저장된 기록이 없습니다.")
        return
 
    total_km = 0.0
    total_min = 0
    total_cal = 0
    run_km = 0.0
    bike_km = 0.0
 
    for w in workouts:
        km = w.distance             
        total_km += km                          # 누적 합계
        total_min += w.minutes
        total_cal += w.calories
        if w.sport == "러닝":
            run_km += km
        elif w.sport == "바이크":
            bike_km += km
 
    hours, minutes = divmod(total_min, 60)
    print("\n[전체 합계]")
    print(f"  기록 수 : {len(workouts)}개")
    print(f"  총 거리 : {total_km:,.1f} km")
    print(f"  총 시간 : {hours}시간 {minutes}분")
    print(f"  총 칼로리: {total_cal:,} kcal")
    print(f"  러닝 {run_km:,.1f} km / 바이크 {bike_km:,.1f} km")
 
 
# ------------------------------------------------------------------
# 7. 메뉴 4: 월별 합계 (딕셔너리 장부 패턴)
# ------------------------------------------------------------------
def show_monthly():
    workouts = load_workouts()
    if len(workouts) == 0:
        print("\n저장된 기록이 없습니다.")
        return
 
    monthly = {}                                 # {"2026-10": {...}, ...}
    for w in workouts:
        month = w.date[:7]                    # "2026-10-12"[:7] → "2026-10"
        if month not in monthly:                 # 칸이 없으면 먼저 만든다
            monthly[month] = {"count": 0, "distance": 0.0, "run": 0.0, "bike": 0.0}
        m = monthly[month]                       # 복사가 아니라 같은 상자를 부르는 이름
        km = w.distance
        m["count"] += 1
        m["distance"] += km
        if w.sport == "러닝":
            m["run"] += km
        elif w.sport == "바이크":
            m["bike"] += km
 
    print("\n[월별 합계]")
    for month in sorted(monthly):                # 이름표(월)를 순서대로
        m = monthly[month]
        print(f"  {month}  {m['count']}회  {m['distance']:,.1f}km "
              f"(러닝 {m['run']:,.1f} / 바이크 {m['bike']:,.1f})")
 
 
# ------------------------------------------------------------------
# 8. 기록 고르기 (삭제와 수정이 같이 쓰는 부분)
# ------------------------------------------------------------------
def choose_record(records, action_name):
    """번호로 기록 하나를 고른다. 취소하면 None을 돌려준다."""
    print(f"\n[기록 {action_name}]")
    for i, r in enumerate(records, start=1):
        print(f"  {i}. {r['날짜']}  {r['종목']}  {r['거리(km)']}km  {r['시간(분)']}분")
 
    num = input_int(f"{action_name}할 번호 (0: 취소): ")
    if num == 0:
        return None
    if num > len(records):
        print("  ※ 없는 번호입니다.")
        return None
    return num - 1                               # 화면 번호 → 리스트 번호는 1 차이
 
 
# ------------------------------------------------------------------
# 9. 메뉴 5: 기록 하나 삭제
# ------------------------------------------------------------------
def delete_record():
    records = load_records()
    if len(records) == 0:
        print("\n저장된 기록이 없습니다.")
        return
 
    index = choose_record(records, "삭제")
    if index is None:
        print("취소했습니다.")
        return
 
    target = records[index]
    answer = input(f"{target['날짜']} {target['종목']} {target['거리(km)']}km 를 삭제할까요? (y/n): ")
    if answer.strip().lower() != "y":            # y가 아니면 전부 취소
        print("취소했습니다.")
        return
 
    removed = records.pop(index)                 # pop은 빼낸 값을 돌려준다
    save_all_records(records)                    # 파일 전체를 다시 쓴다
    print(f"삭제했습니다: {removed['날짜']} {removed['종목']}")
 
 
# ------------------------------------------------------------------
# 10. 메뉴 6: 개인 최고기록 (최댓값/최솟값 찾기 패턴)
# ------------------------------------------------------------------
def show_pr():
    workouts = load_workouts()
    if len(workouts) == 0:
        print("\n저장된 기록이 없습니다.")
        return
 
    best_run = None          # None = "아직 없음"
    best_bike = None
    longest = None
 
    for w in workouts:
        if w.sport == "러닝":
            # 페이스는 '작을수록' 빠르다 → < 로 비교
            if best_run is None or w.pace_sec() < best_run.pace_sec():
                best_run = w
        elif w.sport == "바이크":
            # 속도는 '클수록' 빠르다 → > 로 비교
            if best_bike is None or w.speed() > best_bike.speed():
                best_bike = w
 
        if longest is None or w.distance > longest.distance:
            longest = w
 
    print("\n[개인 최고기록 PR]")
    if best_run is None:                         # None에는 ["거리"]를 쓸 수 없으므로 먼저 확인
        print("  러닝 최고 페이스 : 기록 없음")
    else:
        print(f"  러닝 최고 : {best_run.summary()}  ({best_run.date})")
 
    if best_bike is None:
        print("  바이크 최고 속도 : 기록 없음")
    else:
        print(f"  바이크 최고 : {best_bike.summary()}  ({best_bike.date})")
 
    print(f"  최장 거리        : {longest.distance}km  "
          f"({longest.date} {longest.sport})")
 
 
# ------------------------------------------------------------------
# 11. 메뉴 7: 기록 수정
# ------------------------------------------------------------------
def input_new_value(field, record):
    """항목 종류에 맞는 입력 함수로 새 값을 받는다."""
    if field == "날짜":
        return input_date("새 날짜 (YYYY-MM-DD): ")
    if field == "종목":
        return input_sport("새 종목 (1: 러닝, 2: 바이크): ")
    if field == "거리(km)":
        return input_float("새 거리(km): ", 0.1)
    if field == "시간(분)":
        return input_int("새 시간(분): ", 1)
    if field == "메모":
        return input("새 메모: ").strip()
    return input_int(f"새 {field}: ")             # 나머지는 모두 0 이상의 정수
 
 
def edit_record():
    records = load_records()
    if len(records) == 0:
        print("\n저장된 기록이 없습니다.")
        return
 
    index = choose_record(records, "수정")
    if index is None:
        print("취소했습니다.")
        return
 
    record = records[index]                      # records[index]와 같은 상자! 바꾸면 원본도 바뀜
 
    print("\n수정할 항목을 고르세요.")
    for i, field in enumerate(FIELDS, start=1):
        print(f"  {i}. {field}: {record[field]}")
 
    num = input_int("항목 번호 (0: 취소): ")
    if num == 0 or num > len(FIELDS):
        print("취소했습니다.")
        return
 
    field = FIELDS[num - 1]
    old_value = record[field]
    new_value = input_new_value(field, record)
 
    answer = input(f"{field}: {old_value} → {new_value}  수정할까요? (y/n): ")
    if answer.strip().lower() != "y":
        print("취소했습니다.")
        return
 
    record[field] = str(new_value)               # CSV에는 문자열로 저장
    save_all_records(records)                    # 바뀐 리스트를 파일 전체에 다시 쓴다
    print("수정했습니다.")
 
 
# ------------------------------------------------------------------
# 12. 메뉴 9: 전체 삭제 (위험한 작업은 먼저 묻는다)
# ------------------------------------------------------------------
def clear_records():
    if not os.path.exists(FILE):
        print("\n삭제할 기록이 없습니다.")
        return
 
    answer = input("\n정말 모든 기록을 삭제할까요? (y/n): ")
    if answer.strip().lower() != "y":
        print("취소했습니다.")
        return
 
    os.remove(FILE)
    print("모든 기록을 삭제했습니다.")
 
 