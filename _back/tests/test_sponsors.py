from sqlalchemy import select

from app.models import Event, PartnerCard, PartnerEngagement
from app.modules.sponsors import OVA_SPONSORS, SPEER, sync_ova_sponsors
from app.seed import seed_testing
from tests.conftest import ADMIN, OFFICIAL


def _sponsor(db, event, name):
    return db.scalar(
        select(PartnerCard).where(
            PartnerCard.event_id == event.id, PartnerCard.name == name
        )
    )


def test_ribbon_lists_real_ova_sponsors_with_local_logos(client, demo):
    data = client.get("/v1/sponsors").json()["data"]
    assert [s["name"] for s in data] == [SPEER.name, *[s.name for s in OVA_SPONSORS]]
    for sponsor in data:
        assert sponsor["logo_url"].startswith("/sponsors/")
        assert sponsor["link_url"].startswith("https://")


def test_sync_replaces_placeholders_and_keeps_staff_edits(db, demo):
    mikasa = _sponsor(db, demo, "Mikasa Sports Canada")
    mikasa.body = "Edited by staff"
    db.add(PartnerCard(event_id=demo.id, kind="sponsor", name="Example Sports Co."))
    db.delete(_sponsor(db, demo, "Hudl"))
    db.commit()

    assert sync_ova_sponsors(db) == 1
    assert sync_ova_sponsors(db) == 0
    names = set(
        db.scalars(
            select(PartnerCard.name).where(
                PartnerCard.event_id == demo.id, PartnerCard.kind == "sponsor"
            )
        )
    )
    assert names == {SPEER.name, *[s.name for s in OVA_SPONSORS]}
    assert _sponsor(db, demo, "Mikasa Sports Canada").body == "Edited by staff"


def test_engagement_counts_and_staff_report(client, db, demo):
    hudl = _sponsor(db, demo, "Hudl")
    timu = _sponsor(db, demo, "Timu")
    merch = db.scalar(
        select(PartnerCard).where(
            PartnerCard.event_id == demo.id, PartnerCard.kind == "merchandise"
        )
    )
    items = [
        {"partner_id": str(hudl.id), "placement": "ribbon", "action": "view"},
        {"partner_id": str(hudl.id), "placement": "guide", "action": "view"},
        {"partner_id": str(timu.id), "placement": "guide", "action": "view"},
        {"partner_id": str(timu.id), "placement": "message", "action": "view"},
        # Non-sponsor cards are ignored rather than counted.
        {"partner_id": str(merch.id), "placement": "guide", "action": "view"},
    ]
    assert (
        client.post("/v1/sponsor-engagement", json={"items": items}).status_code == 204
    )
    assert (
        client.post("/v1/sponsor-engagement", json={"items": items[:1]}).status_code
        == 204
    )
    click = {"partner_id": str(hudl.id), "placement": "ribbon", "action": "click"}
    assert (
        client.post("/v1/sponsor-engagement", json={"items": [click]}).status_code
        == 204
    )
    hidden = _sponsor(db, demo, "Canuckstuff")
    hidden.active = False
    db.commit()
    gone = {"partner_id": str(hidden.id), "placement": "ribbon", "action": "click"}
    assert (
        client.post("/v1/sponsor-engagement", json={"items": [gone]}).status_code == 204
    )

    bad = {"partner_id": str(hudl.id), "placement": "popup", "action": "view"}
    assert (
        client.post("/v1/sponsor-engagement", json={"items": [bad]}).status_code == 422
    )
    assert client.post("/v1/sponsor-engagement", json={"items": []}).status_code == 422
    assert (
        db.scalar(
            select(PartnerEngagement).where(PartnerEngagement.partner_id == merch.id)
        )
        is None
    )

    path = f"/v1/admin/events/{demo.id}/sponsor-report"
    assert client.get(path).status_code == 401
    report = {
        row["name"]: row for row in client.get(path, headers=ADMIN).json()["data"]
    }
    assert report["Hudl"]["placements"] == {
        "ribbon": {"views": 2, "clicks": 1},
        "guide": {"views": 1, "clicks": 0},
        "message": {"views": 0, "clicks": 0},
    }
    assert (report["Hudl"]["views"], report["Hudl"]["clicks"]) == (3, 1)
    assert report["Hudl"]["ctr"] == round(1 / 3, 4)
    assert report["Timu"]["placements"]["message"] == {"views": 1, "clicks": 0}
    assert report["Timu"]["views"] == 2 and report["Timu"]["ctr"] == 0
    assert report["Canuckstuff"]["clicks"] == 0
    assert report["Mikasa Sports Canada"]["ctr"] is None
    assert "Championship merchandise (example)" not in report


def test_ribbon_counts_follow_the_sponsor_across_events(client, db, demo):
    seed_testing(db)
    lakeside = db.scalar(select(Event).where(Event.slug == "test-lakeside-beach"))
    ribbon_card = _sponsor(db, lakeside, "Hudl")
    item = {"partner_id": str(ribbon_card.id), "placement": "ribbon", "action": "view"}
    client.post("/v1/sponsor-engagement", json={"items": [item, item]})
    report = client.get(
        f"/v1/admin/events/{demo.id}/sponsor-report", headers=ADMIN
    ).json()["data"]
    hudl = next(row for row in report if row["name"] == "Hudl")
    assert hudl["placements"]["ribbon"] == {"views": 2, "clicks": 0}
    assert hudl["placements"]["guide"] == {"views": 0, "clicks": 0}


def test_report_needs_a_grant_for_that_event(client, db, demo):
    other = db.scalar(select(Event).where(Event.id != demo.id))
    assert other is None  # only the demo event exists in this test
    response = client.get(
        f"/v1/admin/events/{demo.id}/sponsor-report", headers={"X-Dev-User": "stranger"}
    )
    assert response.status_code in (401, 403)
    assert (
        client.get(
            f"/v1/admin/events/{demo.id}/sponsor-report", headers=OFFICIAL
        ).status_code
        == 200
    )


def test_speer_is_first_on_every_event_and_new_staff_events(client, db, demo):
    other = Event(
        organization_id=demo.organization_id,
        slug="independent-open",
        title="Independent Open",
        start_date=demo.start_date,
        end_date=demo.end_date,
        status="published",
    )
    db.add(other)
    db.commit()
    sync_ova_sponsors(db)
    db.add(
        PartnerCard(
            event_id=other.id, kind="sponsor", name="Earlier numeric sort", sort=-20000
        )
    )
    db.commit()
    for event in (demo, other):
        partners = client.get(f"/v1/events/{event.slug}/guide").json()["data"][
            "partners"
        ]
        assert partners[0]["name"] == "Speer"
        assert partners[0]["logo_url"] == "/sponsors/speer.png"
        assert partners[0]["link_url"] == "https://speer.io/"
    assert client.get("/v1/sponsors").json()["data"][0]["name"] == "Speer"
    created = client.post(
        "/v1/admin/events",
        headers=ADMIN,
        json={
            "slug": "new-speer-event",
            "title": "New event",
            "kind": "indoor",
            "timezone": "America/Toronto",
            "start_date": str(demo.start_date),
            "end_date": str(demo.end_date),
        },
    )
    assert created.status_code == 201
    card = _sponsor(
        db, db.scalar(select(Event).where(Event.slug == "new-speer-event")), "Speer"
    )
    assert card and card.logo_url == "/sponsors/speer.png"
