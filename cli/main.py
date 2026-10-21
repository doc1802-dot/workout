"""
운동기록 프로그램 (자전거 / 러닝)  -  파이썬 학습용 코드
 
[전체 구조]
  records.csv  --load_records()-->  리스트 안에 딕셔너리  --기능들-->  화면 출력
  기록 추가: 파일 끝에 한 줄만 붙임("a" 모드)
  삭제/수정: 리스트를 고친 뒤 파일 전체를 다시 씀("w" 모드)
 
[메뉴]
  1 기록 추가 / 2 기록 보기 / 3 합계 / 4 월별 합계
  5 기록 삭제 / 6 개인 최고기록(PR) / 7 기록 수정 / 9 전체 삭제 / 0 종료
"""
 
from features import (add_record, show_records, show_total, show_monthly,
                      delete_record, show_pr, edit_record, clear_records)

 
# ------------------------------------------------------------------
# 13. 메인: 메뉴 반복
# ------------------------------------------------------------------
def main():
    while True:
        print("\n===== 운동기록 프로그램 =====")
        print("1. 기록 추가")
        print("2. 기록 보기")
        print("3. 합계 보기")
        print("4. 월별 합계")
        print("5. 기록 삭제")
        print("6. 개인 최고기록(PR)")
        print("7. 기록 수정")
        print("9. 전체 기록 삭제")
        print("0. 종료")
 
        choice = input("번호 선택: ").strip()
 
        if choice == "1":
            add_record()
        elif choice == "2":
            show_records()
        elif choice == "3":
            show_total()
        elif choice == "4":
            show_monthly()
        elif choice == "5":
            delete_record()
        elif choice == "6":
            show_pr()
        elif choice == "7":
            edit_record()
        elif choice == "9":
            clear_records()
        elif choice == "0":
            print("종료합니다.")
            break                                # 가장 가까운 반복문(while) 탈출
        else:
            print("  ※ 메뉴에 있는 번호를 입력해 주세요.")
 
 
# 이 파일을 직접 실행했을 때만 main()을 실행 (다른 파일에서 import하면 실행 안 됨)
if __name__ == "__main__":
    main()