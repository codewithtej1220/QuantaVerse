from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUser, DatabaseSession
from app.core.config import get_settings
from app.models.auth import StudentProfile
from app.models.teaching import (
    ClaimRequest,
    JoinRequest,
    ModuleClasses,
    ProfessorDashboard,
    TeachingUpdate,
)
from app.services import teaching as service
from app.services.progress import profile_of

"""
Professors and classes.

/api/professor is the professor's side: their classes, the requests waiting on
them, and the modules they teach. Every action there answers with the whole
dashboard again, so the page never has to guess what changed.

/api/classes is the student's side of the same rows: who teaches a module, and
asking to join.
"""

router = APIRouter(tags=["teaching"])


def _fail(error: service.TeachingError) -> HTTPException:
    return HTTPException(status_code=error.status, detail=error.message)


@router.get("/api/professor/signup")
def professor_signup() -> dict[str, bool]:
    """Whether professor sign-up is switched on, so the form can say so first."""
    return {"open": get_settings().professor_signup_open}


@router.get("/api/professor", response_model=ProfessorDashboard)
def professor_dashboard(session: DatabaseSession, user: CurrentUser) -> ProfessorDashboard:
    try:
        return service.dashboard(session, user)
    except service.TeachingError as error:
        raise _fail(error) from error


@router.post("/api/professor/claim", response_model=StudentProfile)
def claim_professor(
    payload: ClaimRequest, session: DatabaseSession, user: CurrentUser
) -> StudentProfile:
    """Turn the signed-in account into a professor's, with the invite code."""
    try:
        service.make_professor(session, user, payload.code, payload.modules)
    except service.TeachingError as error:
        raise _fail(error) from error
    return profile_of(user)


@router.put("/api/professor/modules", response_model=ProfessorDashboard)
def set_teaching(
    payload: TeachingUpdate, session: DatabaseSession, user: CurrentUser
) -> ProfessorDashboard:
    try:
        service.set_modules(session, user, payload.modules)
        return service.dashboard(session, user)
    except service.TeachingError as error:
        raise _fail(error) from error


@router.post("/api/professor/requests/{membership_id}/accept", response_model=ProfessorDashboard)
def accept_student(
    membership_id: int, session: DatabaseSession, user: CurrentUser
) -> ProfessorDashboard:
    try:
        service.respond(session, user, membership_id, accept=True)
        return service.dashboard(session, user)
    except service.TeachingError as error:
        raise _fail(error) from error


@router.post("/api/professor/requests/{membership_id}/decline", response_model=ProfessorDashboard)
def decline_student(
    membership_id: int, session: DatabaseSession, user: CurrentUser
) -> ProfessorDashboard:
    try:
        service.respond(session, user, membership_id, accept=False)
        return service.dashboard(session, user)
    except service.TeachingError as error:
        raise _fail(error) from error


@router.delete("/api/professor/students/{membership_id}", response_model=ProfessorDashboard)
def remove_student(
    membership_id: int, session: DatabaseSession, user: CurrentUser
) -> ProfessorDashboard:
    try:
        service.remove_student(session, user, membership_id)
        return service.dashboard(session, user)
    except service.TeachingError as error:
        raise _fail(error) from error


@router.get("/api/classes/{module_slug}", response_model=ModuleClasses)
def module_classes(module_slug: str, session: DatabaseSession, user: CurrentUser) -> ModuleClasses:
    try:
        return service.module_classes(session, user, module_slug)
    except service.TeachingError as error:
        raise _fail(error) from error


@router.post(
    "/api/classes/{module_slug}", response_model=ModuleClasses, status_code=status.HTTP_201_CREATED
)
def join_class(
    module_slug: str, payload: JoinRequest, session: DatabaseSession, user: CurrentUser
) -> ModuleClasses:
    try:
        service.request_join(
            session, user, module_slug, professor_id=payload.professor_id, note=payload.note
        )
        return service.module_classes(session, user, module_slug)
    except service.TeachingError as error:
        raise _fail(error) from error


@router.delete("/api/classes/membership/{membership_id}", response_model=ModuleClasses)
def leave_class(membership_id: int, session: DatabaseSession, user: CurrentUser) -> ModuleClasses:
    try:
        module_slug = service.leave(session, user, membership_id)
        return service.module_classes(session, user, module_slug)
    except service.TeachingError as error:
        raise _fail(error) from error
