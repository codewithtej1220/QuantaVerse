from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from app.api.routes import execute, tutor
from app.core.config import get_settings
from app.models.api import HealthResponse
from app.models.circuit_ir import MAX_QUBITS, SUPPORTED_GATES
from app.services.adapters.base import AdapterError
from app.services.adapters.factory import available_backends, probe_backends

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description=(
        "Simulation, grading and tutoring for QuantaVerse. One canonical circuit IR, "
        "four backends behind it, and a deterministic grader."
    ),
    contact={"name": settings.team},
    license_info={"name": "MIT"},
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
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=True)
