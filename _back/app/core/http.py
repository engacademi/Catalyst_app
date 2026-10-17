import hashlib
import json
import uuid
from typing import Any

from fastapi import HTTPException, Request, Response, status


def json_response(request: Request, payload: Any, *, max_age: int = 0, private: bool = False) -> Response:
    """JSON with an ETag so polling clients get a cheap 304 when nothing changed.

    Schedule data defaults to no-cache: browsers revalidate every poll instead of reusing
    a copy that might hide a court change.
    """
    body = json.dumps(payload, separators=(",", ":"), default=str).encode()
    etag = '"' + hashlib.sha256(body).hexdigest()[:32] + '"'
    cache = "private, no-store" if private else (f"public, max-age={max_age}" if max_age else "public, no-cache")
    headers = {"ETag": etag, "Cache-Control": cache}
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=status.HTTP_304_NOT_MODIFIED, headers=headers)
    return Response(body, media_type="application/json", headers=headers)


def parse_uuid(value: str, what: str = "id") -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Unknown {what}") from exc


def parse_uuid_list(value: str | None, *, limit: int = 1000) -> list[uuid.UUID] | None:
    if value is None:
        return None
    items = [v for v in value.split(",") if v.strip()]
    if len(items) > limit:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"At most {limit} ids")
    try:
        return [uuid.UUID(v.strip()) for v in items]
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "entry_ids must be UUIDs") from exc
