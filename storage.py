import csv, os


FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "records.csv")
 
FIELDS = [
    "날짜", "종목", "거리(km)", "시간(분)",
    "평균심박", "최대심박", "평균케이던스", "최대케이던스",
    "칼로리", "메모",
]

# ------------------------------------------------------------------
# 3. 파일 읽기 / 쓰기
# ------------------------------------------------------------------
def load_records():
    """CSV를 읽어 '리스트 안에 딕셔너리' 형태로 돌려준다. 파일이 없으면 빈 리스트."""
    if not os.path.exists(FILE):
        return []
    with open(FILE, "r", newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        # reader는 한 번 꺼내면 비고, with가 끝나면 파일도 닫힌다.
        # 그래서 파일이 열려 있는 동안 list()로 전부 꺼내 둔다.
        return list(reader)
 
 
def save_record(record):
    """기록 하나를 파일 끝에 이어 붙인다. 파일이 새로 만들어지면 제목 줄도 쓴다."""
    is_new = not os.path.exists(FILE)
    with open(FILE, "a", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        if is_new:
            writer.writeheader()
        writer.writerow(record)
 
 
def save_all_records(records):
    """리스트 전체를 파일에 다시 쓴다. ("w" 모드는 비우고 처음부터 쓴다)"""
    with open(FILE, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(records)
 
 