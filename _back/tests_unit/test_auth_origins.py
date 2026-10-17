from types import SimpleNamespace
from unittest.mock import patch

import pytest
from fastapi import HTTPException

from app.core.auth import verify_clerk_token
from app.core.config import Settings


@pytest.mark.parametrize(
    "azp,accepted",
    [
        ("https://catalyst-five-gamma.vercel.app", True),
        ("https://catalyst-five-gamma.vercel.app/", True),
        ("https://approved-preview.vercel.app", True),
        ("https://catalyst-five-gamma.vercel.app.attacker.test", False),
        ("https://unapproved.vercel.app", False),
        (None, False),
    ],
)
def test_authorized_party_is_an_exact_configured_origin(azp, accepted):
    settings = Settings(
        auth_mode="clerk",
        auth_issuer="https://issuer.clerk.accounts.dev",
        public_web_url="https://catalyst-five-gamma.vercel.app/",
        clerk_authorized_parties=["https://approved-preview.vercel.app"],
    )
    with (
        patch("app.core.auth._jwks_client") as jwks,
        patch(
            "app.core.auth.jwt.decode", return_value={"sub": "test-user", "azp": azp}
        ),
    ):
        jwks.return_value.get_signing_key_from_jwt.return_value = SimpleNamespace(
            key="test-key"
        )
        if accepted:
            assert verify_clerk_token("token", settings) == "test-user"
        else:
            with pytest.raises(HTTPException) as error:
                verify_clerk_token("token", settings)
            assert error.value.status_code == 401
