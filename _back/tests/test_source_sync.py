from sqlalchemy import select
from app.models import Source
from tests.conftest import ADMIN


def test_failed_source_refresh_preserves_schedule(client, db, demo, monkeypatch):
    source = db.scalar(select(Source).where(Source.event_id == demo.id))
    source.mode = "aes"
    source.config = {"authorized": True, "event_key": "key"}
    db.commit()
    from app.modules import sync

    def denied(*args):
        raise ValueError("Source unavailable")

    monkeypatch.setattr(sync, "fetch_snapshot", denied)
    response = client.post(f"/v1/admin/sources/{source.id}/refresh", headers=ADMIN)
    assert response.status_code == 200 and response.json()["data"]["ok"] is False
    assert client.get("/v1/events/demo-championships/matches").json()["data"]
    detail = client.get("/v1/events/demo-championships").json()
    assert (
        next(s for s in detail["sources"] if s["id"] == str(source.id))["freshness"]
        == "unavailable"
    )


def test_paused_source_does_not_request_upstream(client, db, demo, monkeypatch):
    source = db.scalar(select(Source).where(Source.event_id == demo.id))
    source.status = "paused"
    db.commit()
    from app.modules import sync

    monkeypatch.setattr(
        sync,
        "fetch_snapshot",
        lambda *_: (_ for _ in ()).throw(AssertionError("Must not fetch")),
    )
    assert (
        client.post(f"/v1/admin/sources/{source.id}/refresh", headers=ADMIN).json()[
            "data"
        ]["ok"]
        is False
    )
