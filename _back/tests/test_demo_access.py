from sqlalchemy import select

from app.demo_access import grant_demo_staff
from app.models import Event, RoleGrant, User
from app.seed import seed_testing


def test_demo_grant_populates_dashboard_without_real_event_access(client, db, demo):
    seed_testing(db)
    real = Event(
        organization_id=demo.organization_id,
        slug="real-private",
        title="Private real event",
        kind="indoor",
        timezone=demo.timezone,
        start_date=demo.start_date,
        end_date=demo.end_date,
        is_demo=False,
    )
    db.add(real)
    db.commit()
    headers = {"X-Dev-User": "verified-demo-subject"}
    assert client.get("/v1/admin/events", headers=headers).json()["data"] == []
    events = grant_demo_staff(db, "verified-demo-subject")
    grant_demo_staff(db, "verified-demo-subject")
    db.commit()
    user = db.scalar(select(User).where(User.clerk_subject == "verified-demo-subject"))
    grants = list(db.scalars(select(RoleGrant).where(RoleGrant.user_id == user.id)))
    assert len(grants) == len(events) == 5
    assert all(grant.role == "staff" and grant.event_id for grant in grants)
    visible = client.get("/v1/admin/events", headers=headers).json()["data"]
    assert {row["slug"] for row in visible} == {event.slug for event in events}
    assert client.get(f"/v1/admin/events/{real.id}", headers=headers).status_code == 403
    assert (
        client.patch(
            f"/v1/admin/events/{demo.id}",
            headers=headers,
            json={"title": "Staff-edited demo"},
        ).status_code
        == 200
    )
    seed_testing(db)
    assert len(client.get("/v1/admin/events", headers=headers).json()["data"]) == 5
