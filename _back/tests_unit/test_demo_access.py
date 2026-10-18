import pytest

from app.demo_access import verified_subject


def account(email="parent@example.org", status="verified", subject="user_demo"):
    return {
        "id": subject,
        "email_addresses": [
            {"email_address": email, "verification": {"status": status}}
        ],
    }


def test_email_lookup_requires_exact_verified_unique_account():
    def fetch(request):
        assert request.full_url.endswith("email_address%5B%5D=parent%40example.org")
        return [account(), account("other@example.org")]

    assert (
        verified_subject(" Parent@Example.org ", "test-secret", fetch=fetch)
        == "user_demo"
    )
    for accounts in [
        [],
        [account(status="unverified")],
        [account("other@example.org")],
        [account(), account(subject="second")],
    ]:
        with pytest.raises(ValueError):
            verified_subject(
                "parent@example.org", "test-secret", fetch=lambda _, rows=accounts: rows
            )
    with pytest.raises(ValueError):
        verified_subject("parent@example.org", "", fetch=fetch)
