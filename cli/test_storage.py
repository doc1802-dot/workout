import storage
from workout import Workout


def test_save_and_load_round_trip(tmp_path, monkeypatch):
    # 진짜 records.csv 대신 임시 파일을 쓰게 바꿈
    monkeypatch.setattr(storage, "FILE", str(tmp_path / "test.csv"))

    w = Workout("2026-10-18", "러닝", "5.0", "27", 150, 170, 170, 180, 400, "테스트")
    storage.save_workout(w)

    loaded = storage.load_workouts()
    assert len(loaded) == 1
    assert loaded[0].distance == 5.0
    assert loaded[0].summary() == "평균페이스: 5분 24초 /km" 