from functools import lru_cache
from typing import Annotated, Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: Literal["development", "test", "staging", "production"] = "development"
    log_level: str = "INFO"
    database_url: str = "postgresql+psycopg://postgres@localhost:54329/courtside"
    public_web_url: str = "http://localhost:3000"
    cors_allowed_origins: Annotated[list[str], NoDecode] = ["http://localhost:3000"]

    # "clerk" verifies Clerk session JWTs; "dev" trusts an X-Dev-User header and is
    # refused outside development/test.
    auth_mode: Literal["clerk", "dev"] = "dev"
    auth_issuer: str | None = None
    clerk_jwks_url: str | None = None
    clerk_authorized_parties: Annotated[list[str], NoDecode] = []

    # Assumed match window for My Day overlap warnings. Labeled as an assumption in the UI.
    assumed_match_minutes: int = 60
    import_max_bytes: int = 5 * 1024 * 1024
    import_max_rows: int = 10_000

    @field_validator("database_url")
    @classmethod
    def use_psycopg_driver(cls, value: str) -> str:
        # Railway hands out postgres:// or postgresql:// URLs; SQLAlchemy needs the driver named.
        for prefix in ("postgres://", "postgresql://"):
            if value.startswith(prefix):
                return "postgresql+psycopg://" + value[len(prefix) :]
        return value

    @field_validator("cors_allowed_origins", "clerk_authorized_parties", mode="before")
    @classmethod
    def split_list(cls, value: object) -> object:
        if isinstance(value, str):
            value = value.strip()
            if value.startswith("["):
                import json

                return json.loads(value)
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @property
    def dev_auth_allowed(self) -> bool:
        return self.auth_mode == "dev" and self.app_env in ("development", "test")

    @property
    def jwks_url(self) -> str | None:
        if self.clerk_jwks_url:
            return self.clerk_jwks_url
        if self.auth_issuer:
            return self.auth_issuer.rstrip("/") + "/.well-known/jwks.json"
        return None


@lru_cache
def get_settings() -> Settings:
    return Settings()
