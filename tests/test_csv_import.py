from backend.csv_import import parse_csv

CSV = """날짜,종목,거리(km),시간(분),평균심박,최대심박,평균케이던스,최대케이던스,칼로리,메모
2026-10-01,러닝,5.0,30,160,180,170,180,450,태화강 런
2026-10-14,러닝,5.5,38,140,160,0,0,0,
2026-13-40,러닝,5.0,30,0,0,0,0,0,날짜 틀림
2026-10-15,수영장,1.0,30,0,0,0,0,0,종목 틀림
""".encode("utf-8-sig")


def test_parse_cli_csv():
    workouts, skipped = parse_csv(CSV)
    assert skipped == 2
    assert len(workouts) == 2
    first = workouts[0]
    assert first.duration_sec == 1800             # 분 → 초
    assert first.memo == "태화강 런"
    assert first.source == "csv"
    assert workouts[1].avg_cad is None            # 0(모름) → None
    assert workouts[1].calories is None
    assert first.external_id != workouts[1].external_id
