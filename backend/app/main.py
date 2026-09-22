from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from app.api.routes import (
    auth,
    execute,
    network,
    notes,
    own_modules,
    progress,
    teaching,
    tutor,
)
from app.core.config import get_settings
from app.db.seed import seed_demo_mentors
from app.db.session import database_status, init_db, session_scope
from app.models.api import HealthResponse
from app.models.circuit_ir import MAX_QUBITS, SUPPORTED_GATES
from app.services.adapters.base import AdapterError
from app.services.adapters.factory import available_backends, probe_backends

settings = get_settings()


def _boot() -> None:
    init_db()
    # A research hub that opens on an empty list looks broken rather than new,
    # so a fresh install gets four clearly-labelled example mentors to browse.
    with session_scope() as session:
        seed_demo_mentors(session)


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncIterator[None]:
    await run_in_threadpool(_boot)
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description=(
        "Simulation, grading and tutoring for QuantaVerse. One canonical circuit IR, "
        "four backends behind it, a deterministic grader, and a student record that "
        "tracks lessons, graded circuits and badges."
    ),
    contact={"name": settings.team},
    license_info={"name": "MIT"},
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_origin_regex=".*" if "*" in settings.allowed_origins else None,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

app.include_router(execute.router)
app.include_router(tutor.router)
app.include_router(auth.router)
app.include_router(progress.router)
app.include_router(network.router)
app.include_router(notes.router)
app.include_router(teaching.router)
app.include_router(own_modules.router)


@app.exception_handler(AdapterError)
async def adapter_error_handler(request: Request, error: AdapterError) -> JSONResponse:
    return JSONResponse(
        status_code=422, content={"detail": error.message, "backend": error.backend}
    )


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, error: ValueError) -> JSONResponse:
    return JSONResponse(status_code=400, content={"detail": str(error)})


@app.get("/")
async def root() -> dict[str, Any]:
    return {
        "name": settings.app_name,
        "version": settings.version,
        "team": settings.team,
        "docs": "/docs",
        "endpoints": [
            "POST /api/simulate",
            "POST /api/grade",
            "POST /api/introspect",
            "POST /api/tutor/ask",
            "POST /api/tutor/explain",
            "POST /api/auth/register",
            "POST /api/auth/login",
            "POST /api/auth/refresh",
            "POST /api/auth/logout",
            "GET /api/auth/me",
            "GET /api/progress",
            "POST /api/progress/lessons",
            "GET /api/progress/exercises",
            "GET /api/dashboard",
            "GET /api/catalog",
            "GET /api/notes/{module_slug}",
            "POST /api/notes/{module_slug}",
            "GET /api/notes/file/{note_id}",
            "DELETE /api/notes/file/{note_id}",
            "GET /api/professor",
            "PUT /api/professor/modules",
            "POST /api/professor/modules/own",
            "PUT /api/professor/modules/own/{id}",
            "DELETE /api/professor/modules/own/{id}",
            "GET /api/own-modules",
            "GET /api/own-modules/{slug}",
            "POST /api/own-modules/{slug}/lessons/{index}",
            "DELETE /api/own-modules/{slug}/lessons/{index}",
            "POST /api/professor/requests/{id}/accept",
            "POST /api/professor/requests/{id}/decline",
            "DELETE /api/professor/students/{id}",
            "GET /api/classes/{module_slug}",
            "POST /api/classes/{module_slug}",
            "DELETE /api/classes/membership/{id}",
            "GET /api/backends",
            "GET /api/health",
        ],
        "backends": available_backends(),
        "max_qubits": MAX_QUBITS,
        "gates": list(SUPPORTED_GATES),
    }


@app.get("/api/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        version=settings.version,
        backends=await run_in_threadpool(probe_backends),
        tutor={
            "live": settings.tutor_live,
            "model": settings.openai_model if settings.tutor_live else None,
            "fallback": "deterministic circuit read-out",
        },
        accounts={
            "database": settings.database_kind,
            "registration_open": settings.registration_open,
            "access_token_minutes": settings.access_token_minutes,
            "refresh_token_days": settings.refresh_token_days,
            "signing_key": "ephemeral" if settings.jwt_secret_ephemeral else "configured",
            "tables": database_status()["tables"],
        },
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=True)
