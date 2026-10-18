from sqlalchemy import select

from app.models import EventEntry, Match
from app.seed import seed_testing
from tests.conftest import ADMIN, OFFICIAL


def test_search_and_testing_tournaments(client, db, demo):
    first = seed_testing(db)
    assert len(first) == 2
    assert seed_testing(db) == []
    assert len(client.get("/v1/events").json()["data"]) == 4
    assert set(
        db.scalars(
            select(Match.status).where(Match.event_id.in_([e.id for e in first]))
        )
    ) >= {"scheduled", "in_progress", "completed"}
    for term, kind in [
        ("Lakeside", "Tournament"),
        ("Sunset Servers", "Team"),
        ("Hamilton Sports Hall", "Venue"),
    ]:
        results = client.get("/v1/search", params={"q": term}).json()["data"]
        assert any(result["kind"] == kind for result in results)
    assert client.get("/v1/search?q=%25").json()["data"] == []
    assert len(client.get("/v1/sponsors").json()["data"]) == 5


def test_account_type_cannot_escalate_and_following_is_scoped(client, db, demo):
    player = {"X-Dev-User": "new-player"}
    fan = {"X-Dev-User": "new-fan"}
    outsider = {"X-Dev-User": "outsider"}
    entry = db.scalar(select(EventEntry).where(EventEntry.event_id == demo.id))
    assert client.get("/v1/me/profile").status_code == 401
    response = client.put(
        "/v1/me/profile",
        headers=player,
        json={
            "display_name": "Test Player",
            "account_type": "player",
            "team_entry_id": str(entry.id),
            "discoverable": True,
        },
    )
    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "private, no-store"
    player_id = response.json()["data"]["user_id"]
    players = client.get("/v1/me/players?q=Test", headers=fan).json()["data"]
    assert players[0]["display_name"] == "Test Player"
    path = f"/v1/me/players/{player_id}/follow"
    assert client.put(path, headers=fan).status_code == 200
    assert client.put(path, headers=fan).status_code == 200
    assert (
        len(client.get("/v1/me/profile", headers=player).json()["data"]["followers"])
        == 1
    )
    assert (
        client.get("/v1/me/profile", headers=outsider).json()["data"]["followers"] == []
    )
    assert client.put(path, headers=player).status_code == 404
    assert client.delete(path, headers=fan).status_code == 204
    assert (
        client.get("/v1/me/profile", headers=player).json()["data"]["followers"] == []
    )
    client.put(path, headers=fan)
    client.put(
        "/v1/me/profile",
        headers=player,
        json={
            "display_name": "Test Player",
            "account_type": "player",
            "discoverable": False,
        },
    )
    assert client.get("/v1/me/players", headers=fan).json()["data"] == []
    assert client.put(path, headers=fan).status_code == 404
    assert (
        client.put(
            "/v1/me/profile",
            headers=player,
            json={
                "display_name": "Test Player",
                "account_type": "officer",
                "officer_type": "coach",
            },
        ).status_code
        == 200
    )
    assert client.get("/v1/admin/events", headers=player).json()["data"] == []
    assert (
        client.patch(
            f"/v1/admin/events/{demo.id}",
            headers=player,
            json={"title": "Unauthorized edit"},
        ).status_code
        == 403
    )


def test_admin_grants_and_revokes_officer_event_access(client, db, demo):
    other = seed_testing(db)[0]
    officer = {"X-Dev-User": "new-officer"}
    uid = client.get("/v1/me/profile", headers=officer).json()["data"]["user_id"]
    path = f"/v1/admin/events/{demo.id}/access"
    assert (
        client.post(
            path, headers=officer, json={"user_id": uid, "role": "official"}
        ).status_code
        == 403
    )
    grant = client.post(path, headers=ADMIN, json={"user_id": uid, "role": "official"})
    assert grant.status_code == 201
    assert len(client.get("/v1/admin/events", headers=officer).json()["data"]) == 1
    assert (
        client.patch(
            f"/v1/admin/events/{demo.id}",
            headers=officer,
            json={"title": "Approved edit", "expected_revision": demo.revision},
        ).status_code
        == 200
    )
    assert (
        client.patch(
            f"/v1/admin/events/{other.id}",
            headers=officer,
            json={"title": "Wrong event"},
        ).status_code
        == 403
    )
    assert client.get(path, headers=officer).status_code == 403
    assert (
        client.delete(f"{path}/{grant.json()['data']['id']}", headers=ADMIN).status_code
        == 204
    )
    assert (
        client.patch(
            f"/v1/admin/events/{demo.id}", headers=officer, json={"title": "Revoked"}
        ).status_code
        == 403
    )


def test_draft_guide_and_optimistic_content_editing(client, db, demo):
    client.patch(f"/v1/admin/events/{demo.id}", headers=ADMIN, json={"status": "draft"})
    items = client.get(f"/v1/admin/events/{demo.id}/guide-items", headers=ADMIN)
    assert items.status_code == 200
    item = items.json()["data"]["items"][0]
    payload = {
        k: item[k] for k in ["kind", "title", "body", "link_url", "venue_id", "sort"]
    }
    payload["expected_revision"] = item["revision"]
    path = f"/v1/admin/guide-items/{item['id']}"
    assert client.put(path, headers=ADMIN, json=payload).status_code == 200
    assert client.put(path, headers=ADMIN, json=payload).status_code == 409


def test_courts_and_match_scores_are_editable_only_in_granted_events(client, db, demo):
    from app.models import Venue

    venue = db.scalar(select(Venue).where(Venue.event_id == demo.id))
    created = client.post(
        f"/v1/admin/venues/{venue.id}/courts",
        headers=OFFICIAL,
        json={"label": "Court 20", "area_label": "North"},
    )
    assert created.status_code == 201
    court_id = created.json()["data"]["id"]
    assert (
        client.patch(
            f"/v1/admin/courts/{court_id}",
            headers=OFFICIAL,
            json={"label": "Court 21", "area_label": "North"},
        ).status_code
        == 200
    )
    assert (
        client.post(
            f"/v1/admin/venues/{venue.id}/courts",
            headers=ADMIN,
            json={"label": "Court 21"},
        ).status_code
        == 409
    )
    match = db.scalar(select(Match).where(Match.event_id == demo.id))
    result = client.patch(
        f"/v1/admin/matches/{match.id}",
        headers=OFFICIAL,
        json={
            "expected_revision": match.revision,
            "sets": [[25, 20], [25, 21]],
            "status": "completed",
            "court_id": court_id,
        },
    )
    assert result.status_code == 200
    public = client.get(f"/v1/matches/{match.id}").json()["data"]
    assert public["sets"][0]["home"] == 25
    assert public["status"] == "completed"
    assert public["court"]["label"] == "Court 21 · North"
