"""Strava 웹훅 이벤트 처리 (Strava에서 활동을 만들거나 고치거나 지우면 몇 초 안에 반영).

Strava 웹훅에는 서명이 없어서 누구나 가짜 이벤트를 보낼 수 있다. 그래서
  - 구독 id가 우리 것과 다르면 무시하고,
  - 이벤트 내용을 믿지 않고 항상 그 선수의 토큰으로 Strava API를 다시 조회한다.
    (만들기·고치기 → 활동을 다시 받아 저장, 지우기 → Strava에서 정말 404일 때만 삭제)
"""
from backend import strava


def handle_event(event, store, subscription_id=None, now=None):
    """이벤트 하나를 처리하고 무엇을 했는지 짧은 문자열로 돌려준다 (로그·테스트용)."""
    if subscription_id and str(event.get("subscription_id")) != str(subscription_id):
        return "ignored: other subscription"
    owner = event.get("owner_id")
    if not isinstance(owner, int):
        return "ignored: no owner"

    # 선수가 Strava에서 이 앱의 권한을 해제함
    if event.get("object_type") == "athlete":
        if (event.get("updates") or {}).get("authorized") == "false":
            store.disconnect(owner)
            return "disconnected"
        return "ignored: athlete update"

    if event.get("object_type") != "activity":
        return "ignored: object type"
    activity_id = strava.activity_id(event.get("object_id"))
    connection = store.connection_for_athlete(owner)
    if connection is None:
        return "ignored: not connected"

    new_token = strava.refresh_if_needed(connection, now)
    if new_token:
        store.save_tokens(connection["user_id"], new_token)
        connection.update(new_token)

    try:
        activity = strava.api_get(connection["access_token"], f"/activities/{activity_id}", "활동")
    except strava.StravaError as exc:
        if exc.status == 404 and event.get("aspect_type") == "delete":
            store.delete_workout(connection["user_id"], activity_id)
            return "deleted"
        if exc.status == 404:
            return "ignored: not visible"          # 비공개로 바뀌었거나 이미 지워짐
        raise

    row = strava.to_workout(activity).to_db()
    row.pop("memo")                                 # 사용자가 쓴 메모는 덮어쓰지 않는다
    store.upsert_workout(connection["user_id"], row)
    return "saved"
