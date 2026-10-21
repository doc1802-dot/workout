"""Strava 웹훅 처리: 가짜 이벤트를 믿지 않고 Strava API로 다시 확인하는지 검사한다."""
import pytest

from backend import strava, strava_webhook
from tests.test_strava_mapping import NIGHT_RUN

USER = "0e182d39-0bcd-4f77-8d68-1e17e6b9a5cd"


class FakeStore:
    def __init__(self, connected=True):
        self.connection = {"user_id": USER, "access_token": "tok", "refresh_token": "r",
                           "expires_at": "2099-01-01T00:00:00+00:00"} if connected else None
        self.calls = []

    def connection_for_athlete(self, athlete_id):
        self.calls.append(("conn", athlete_id))
        return dict(self.connection) if self.connection else None

    def save_tokens(self, user_id, token):
        self.calls.append(("tokens", user_id))

    def upsert_workout(self, user_id, row):
        self.calls.append(("upsert", user_id, row))

    def delete_workout(self, user_id, external_id):
        self.calls.append(("delete", user_id, external_id))

    def disconnect(self, athlete_id):
        self.calls.append(("disconnect", athlete_id))


def event(**kw):
    return {"object_type": "activity", "object_id": 20406610343, "aspect_type": "create",
            "owner_id": 89111941, "subscription_id": 7, **kw}


@pytest.fixture
def strava_api(monkeypatch):
    calls = []

    def fake_get(token, path, what, **params):
        calls.append(path)
        if fake_get.missing:
            raise strava.StravaError("없음", 404)
        return NIGHT_RUN

    fake_get.missing = False
    monkeypatch.setattr(strava, "api_get", fake_get)
    return fake_get, calls


def test_create_fetches_from_strava_and_keeps_memo(strava_api):
    _, calls = strava_api
    store = FakeStore()
    assert strava_webhook.handle_event(event(), store, subscription_id=7) == "saved"
    assert calls == ["/activities/20406610343"]
    kind, user, row = store.calls[-1]
    assert (kind, user) == ("upsert", USER)
    assert row["external_id"] == str(NIGHT_RUN["id"]) and "memo" not in row


def test_forged_delete_of_existing_activity_does_not_delete(strava_api):
    store = FakeStore()
    assert strava_webhook.handle_event(event(aspect_type="delete"), store) == "saved"
    assert not any(c[0] == "delete" for c in store.calls)


def test_delete_only_when_strava_says_404(strava_api):
    fake_get, _ = strava_api
    fake_get.missing = True
    store = FakeStore()
    assert strava_webhook.handle_event(event(aspect_type="delete"), store) == "deleted"
    assert store.calls[-1] == ("delete", USER, "20406610343")


def test_other_subscription_and_unknown_owner_ignored(strava_api):
    _, calls = strava_api
    assert strava_webhook.handle_event(event(subscription_id=999), FakeStore(), 7).startswith("ignored")
    assert strava_webhook.handle_event(event(), FakeStore(connected=False)) == "ignored: not connected"
    assert strava_webhook.handle_event(event(owner_id="x"), FakeStore()) == "ignored: no owner"
    assert calls == []


def test_path_traversal_object_id_rejected(strava_api):
    with pytest.raises(strava.StravaError):
        strava_webhook.handle_event(event(object_id="../athlete"), FakeStore())


def test_deauthorize_disconnects():
    store = FakeStore()
    ev = {"object_type": "athlete", "object_id": 89111941, "aspect_type": "update",
          "owner_id": 89111941, "updates": {"authorized": "false"}}
    assert strava_webhook.handle_event(ev, store) == "disconnected"
    assert store.calls == [("disconnect", 89111941)]
