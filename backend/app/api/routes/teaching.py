from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUser, DatabaseSession
from app.models.teaching import (
    JoinRequest,
    ModuleClasses,
    OwnModuleRequest,
    ProfessorDashboard,
    TeachingUpdate,
)
from app.services import notes as notes_service
from app.services import teaching as service

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


@router.get("/api/professor", response_model=ProfessorDashboard)
def professor_dashboard(session: DatabaseSession, user: CurrentUser) -> ProfessorDashboard:
    try:
        return service.dashboard(session, user)
    except service.TeachingError as error:
        raise _fail(error) from error


@router.put("/api/professor/modules", response_model=ProfessorDashboard)
def set_teaching(
    payload: TeachingUpdate, session: DatabaseSession, user: CurrentUser
) -> ProfessorDashboard:
    try:
        service.set_modules(session, user, payload.modules)
        return service.dashboard(session, user)
    except service.TeachingError as error:
        raise _fail(error) from error


@router.post(
    "/api/professor/modules/own",
    response_model=ProfessorDashboard,
    status_code=status.HTTP_201_CREATED,
)
def add_own_module(
    payload: OwnModuleRequest, session: DatabaseSession, user: CurrentUser
) -> ProfessorDashboard:
    """A module of the professor's own, named by them, for their own notes."""
    try:
        service.add_own_module(session, user, payload.title, payload.summary)
        return service.dashboard(session, user)
    except service.TeachingError as error:
        raise _fail(error) from error


@router.delete("/api/professor/modules/own/{module_id}", response_model=ProfessorDashboard)
def remove_own_module(
    module_id: int, session: DatabaseSession, user: CurrentUser
) -> ProfessorDashboard:
    """Remove it, and the notes under it — nothing else could reach them."""
    try:
        module = service.own_module(session, user, module_id)
        notes_service.delete_module_notes(session, user, module.slug)
        service.remove_own_module(session, user, module)
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
