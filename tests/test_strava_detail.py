"""Strava 상세 응답 → 화면용 dict 변환과 GPX 만들기를 검사한다."""
from backend import strava_detail as sd

ACTIVITY = {
    "id": 20406610343, "name": "Night Run", "sport_type": "Run", "description": "인터벌",
    "device_name": "Garmin Forerunner 265", "average_speed": 3.134, "max_speed": 3.88,
    "calories": 407, "kudos_count": 3, "pr_count": 0, "total_photo_count": 0,
    "gear": {"id": "g1", "name": "Novablast 5", "distance": 512345},
    "map": {"polyline": "full", "summary_polyline": "summary"},
    "splits_metric": [{"split": 1, "distance": 1000.0, "elapsed_time": 312, "moving_time": 310,
                       "average_speed": 3.22, "elevation_difference": 1.2, "average_heartrate": 160.4}],
    "laps": [{"lap_index": 1, "name": "Lap 1", "distance": 5011.8, "elapsed_time": 1834,
              "moving_time": 1599, "average_speed": 3.134, "average_cadence": 86.5,
              "average_heartrate": 171.4, "max_heartrate": 188}],
    "segment_efforts": [{"name": "태화강 직선", "distance": 1200, "elapsed_time": 380, "moving_time": 380,
                         "pr_rank": 2, "kom_rank": None, "segment": {"id": 7, "average_grade": 0.3}}],
}
STREAMS = {
    "time": {"data": [0, 10, 20]},
    "distance": {"data": [0, 30.6, 61.0]},
    "heartrate": {"data": [150, 160, 170]},
    "cadence": {"data": [85, 86, 87]},
    "latlng": {"data": [[35.5, 129.3], [35.50021, 129.30012], [35.5004, 129.3003]]},
    "velocity_smooth": {"data": [3.0, 3.1]},          # 길이가 다르면 버린다
}


def test_activity_view():
    v = sd.activity_view(ACTIVITY, STREAMS)
    assert v["url"] == "https://www.strava.com/activities/20406610343"
    assert v["gear"] == {"id": "g1", "name": "Novablast 5", "distance_km": 512.35}
    assert v["average_speed_kmh"] == 11.3 and v["polyline"] == "full"
    assert v["splits"][0] == {"index": 1, "distance_km": 1.0, "elapsed_sec": 312, "moving_sec": 310,
                              "pace_sec_per_km": 310, "speed_kmh": 11.6, "elevation_diff_m": 1.2,
                              "avg_hr": 160}
    assert v["laps"][0]["avg_cad"] == 173                   # 러닝은 ×2
    assert v["segments"][0]["id"] == 7 and v["segments"][0]["pr_rank"] == 2
    s = v["streams"]
    assert s["distance_km"] == [0, 0.031, 0.061] and s["cadence"] == [170, 172, 174]
    assert s["speed_kmh"] is None and s["altitude_m"] is None
    assert s["latlng"][1] == [35.50021, 129.30012]


def test_activity_view_without_streams():
    assert sd.activity_view({**ACTIVITY, "map": None}, None)["streams"] is None


def test_downsample_keeps_ends():
    picks, length = sd.downsample({"time": {"data": list(range(1000))}}, limit=400)
    assert length == 1000 and len(picks) == 400 and picks[0] == 0 and picks[-1] == 999


def test_profile_view():
    athlete = {"id": 89111941, "firstname": "덕환", "lastname": "김", "profile": "https://x/p.jpg",
               "city": "Ulsan", "summit": True, "ftp": None,
               "bikes": [{"id": "b1", "name": "Tarmac", "distance": 3420100, "primary": True}], "shoes": []}
    stats = {"ytd_ride_totals": {"count": 30, "distance": 1500000, "moving_time": 200000,
                                 "elevation_gain": 12000.4}}
    v = sd.profile_view(athlete, stats)
    assert v["athlete"]["name"] == "덕환 김" and v["athlete"]["premium"] is True
    assert v["gear"]["bikes"][0]["distance_km"] == 3420.1
    assert v["totals"]["ytd_ride"] == {"count": 30, "distance_km": 1500.0, "moving_sec": 200000,
                                       "elevation_m": 12000}
    assert v["totals"]["all_run"]["count"] == 0


def test_profile_default_avatar_is_hidden():
    v = sd.profile_view({"id": 1, "profile": "avatar/athlete/large.png"}, {})
    assert v["athlete"]["profile_url"] is None


def test_segment_view():
    seg = {"id": 7, "name": "남산 업힐", "activity_type": "Ride", "distance": 2100, "average_grade": 5.2,
           "athlete_pr_effort": {"pr_elapsed_time": 600, "start_date_local": "2026-09-01T07:00:00Z",
                                 "effort_count": 12}}
    v = sd.segment_view(seg)
    assert v["distance_km"] == 2.1 and v["pr_elapsed_sec"] == 600 and v["pr_date"] == "2026-09-01"
    assert v["url"] == "https://www.strava.com/segments/7"


def test_build_gpx_escapes_and_converts_to_utc():
    gpx = sd.build_gpx("A & B <run>", [
        {"lat": 35.5, "lng": 129.3, "time": "2026-10-21T15:00:00+09:00", "ele": 10},
        {"lat": 35.51, "lng": 129.31, "time": "2026-10-21T06:00:05Z"},
    ])
    assert "<name>A &amp; B &lt;run&gt;</name>" in gpx
    assert '<trkpt lat="35.500000" lon="129.300000"><ele>10.0</ele><time>2026-10-21T06:00:00Z</time>' in gpx
    assert "<time>2026-10-21T06:00:05Z</time></trkpt>" in gpx
