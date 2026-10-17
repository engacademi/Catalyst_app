import asyncio
from contextlib import asynccontextmanager, suppress
import logging
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from app.api import admin, me, public
from app.core.config import get_settings
from app.core.db import get_engine

settings = get_settings()
logging.basicConfig(level=settings.log_level)
log = logging.getLogger("courtside")

if settings.auth_mode == "dev" and not settings.dev_auth_allowed:
    raise RuntimeError(
        "AUTH_MODE=dev is only allowed when APP_ENV is development or test"
    )


@asynccontextmanager
async def lifespan(app):
    from app.modules.sync import poll_sources

    task = asyncio.create_task(poll_sources())
    yield
    task.cancel()
    with suppress(asyncio.CancelledError):
        await task


app = FastAPI(lifespan=lifespan, title="Courtside Connected API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "If-None-Match",
        "X-Dev-User",
        "X-Request-ID",
    ],
    expose_headers=["ETag", "X-Request-ID"],
)


@app.middleware("http")
async def request_id(request: Request, call_next):
    request.state.request_id = request.headers.get("x-request-id") or uuid.uuid4().hex
    response = await call_next(request)
    response.headers["X-Request-ID"] = request.state.request_id
    return response


@app.exception_handler(OperationalError)
async def database_unavailable(request: Request, exc: OperationalError) -> JSONResponse:
    # Never answer with an empty schedule when the data can't be read.
    log.error("database unavailable: %s", exc.__class__.__name__)
    return JSONResponse(
        {"detail": "Event data is temporarily unavailable"}, status_code=503
    )


@app.get("/health/live", tags=["health"])
def live() -> dict:
    return {"status": "ok"}


@app.get("/health/ready", tags=["health"])
def ready() -> JSONResponse:
    try:
        with get_engine().connect() as conn:
            conn.execute(text("select 1"))
    except OperationalError:
        return JSONResponse({"status": "unavailable"}, status_code=503)
    return JSONResponse({"status": "ok"})


app.include_router(public.router)
app.include_router(admin.router)
app.include_router(me.router)
