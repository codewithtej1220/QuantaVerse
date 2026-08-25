from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.api.deps import DatabaseSession, OptionalUser
from app.db.models import User
from app.models.api import (
    GradeRequest,
    GradeResponse,
    SandboxRequest,
    SandboxResponse,
    SimulationRequest,
    SimulationResponse,
)
from app.models.circuit_ir import SUPPORTED_GATES
from app.services.adapters.base import AdapterError
from app.services.adapters.factory import (
    UnknownBackendError,
    available_backends,
    get_adapter,
    probe_backends,
)
from app.services.grader import grade
from app.services.sandbox import execute_and_introspect
from app.services import progress as progress_service
from app.core.config import get_settings

router = APIRouter(prefix="/api", tags=["simulation"])


def _score_of(checks: list[dict[str, Any]], name: str) -> float | None:
    for check in checks:
        if check.get("check") == name:
            return float(check.get("score", 0.0))
    return None


def _record_grade(
    session: Session, user: User, slug: str, payload: dict[str, Any]
) -> list[str]:
    checks = payload.get("checks") or []
    scores = [float(check.get("score", 0.0)) for check in checks]
    progress_service.record_attempt(
        session,
        user,
        slug,
        passed=bool(payload.get("passed")),
        score=min(scores) if scores else 0.0,
        state_fidelity=_score_of(checks, "state_fidelity"),
        unitary_fidelity=_score_of(checks, "unitary_equivalence"),
    )
    snapshot = progress_service.build_snapshot(session, user, award=True)
    return [badge.id for badge in snapshot.fresh_badges]


@router.get("/backends")
async def backends() -> dict[str, Any]:
    return {
        "default": get_settings().default_backend,
        "available": available_backends(),
        "detail": await run_in_threadpool(probe_backends),
        "gates": list(SUPPORTED_GATES),
    }


@router.post("/simulate", response_model=SimulationResponse)
async def simulate(request: SimulationRequest) -> SimulationResponse:
    try:
        adapter = get_adapter(request.backend)
    except UnknownBackendError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    try:
        payload = await run_in_threadpool(adapter.simulate, request.circuit, request.shots)
    except AdapterError as error:
        raise HTTPException(status_code=422, detail=error.message) from error
    except MemoryError as error:
        raise HTTPException(
            status_code=413, detail="that register is too large to simulate here"
        ) from error
    except Exception as error:
        raise HTTPException(
            status_code=500, detail=f"{request.backend} failed: {error}"
        ) from error

    return SimulationResponse(**payload)


@router.post("/grade", response_model=GradeResponse)
async def grade_submission(
    request: GradeRequest, session: DatabaseSession, user: OptionalUser
) -> GradeResponse:
    try:
        payload = await run_in_threadpool(
            grade, request.target, request.submission, request.threshold
        )
    except AdapterError as error:
        raise HTTPException(status_code=422, detail=error.message) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"grading failed: {error}") from error

    recorded = False
    earned: list[str] = []

    if user is not None and request.challenge_slug:
        try:
            earned = await run_in_threadpool(
                _record_grade, session, user, request.challenge_slug, payload
            )
            recorded = True
        except progress_service.UnknownChallengeError as error:
            raise HTTPException(status_code=404, detail=str(error)) from error

    return GradeResponse(**payload, recorded=recorded, earned_badges=earned)


@router.post("/introspect", response_model=SandboxResponse)
async def introspect(request: SandboxRequest) -> SandboxResponse:
    settings = get_settings()
    payload = await run_in_threadpool(
        execute_and_introspect, request.code, request.variable, settings.sandbox_timeout
    )
    return SandboxResponse(**payload)
