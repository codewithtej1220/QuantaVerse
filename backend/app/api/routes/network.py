from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import CurrentUser, DatabaseSession
from app.models.network import (
    ConnectRequest,
    ConnectionRecord,
    DirectoryResponse,
    NetworkResponse,
    PersonCard,
    ProfileCard,
)
from app.services import network as service

"""
The research hub.

Every route needs an account. A directory of named people with their
institutions is exactly the kind of thing that should not be readable by
anyone who happens to find the URL, and the connection graph is nobody's
business but the two people in it.
"""

router = APIRouter(prefix="/api/network", tags=["network"])


def _fail(error: service.NetworkError) -> HTTPException:
    return HTTPException(status_code=error.status, detail=error.message)


@router.get("/directory", response_model=DirectoryResponse)
def browse(
    session: DatabaseSession,
    user: CurrentUser,
    q: str | None = Query(default=None, max_length=80),
    role: str | None = Query(default=None, pattern="^(student|mentor|professor)$"),
    mentors_only: bool = Query(default=False),
) -> DirectoryResponse:
    people, total = service.directory(
        session, user, query=q, role=role, mentors_only=mentors_only
    )
    return DirectoryResponse(people=people, total=total, query=q, role=role)  # type: ignore[arg-type]


@router.get("", response_model=NetworkResponse)
def my_network(session: DatabaseSession, user: CurrentUser) -> NetworkResponse:
    return NetworkResponse(**service.network_of(session, user))  # type: ignore[arg-type]


@router.post("/requests", response_model=ConnectionRecord, status_code=status.HTTP_201_CREATED)
def send_request(
    payload: ConnectRequest, session: DatabaseSession, user: CurrentUser
) -> ConnectionRecord:
    try:
        return service.request_connection(
            session, user, handle=payload.handle, note=payload.note
        )
    except service.NetworkError as error:
        raise _fail(error) from error


@router.post("/requests/{connection_id}/accept", response_model=ConnectionRecord)
def accept_request(
    connection_id: int, session: DatabaseSession, user: CurrentUser
) -> ConnectionRecord:
    try:
        return service.respond(session, user, connection_id, accept=True)
    except service.NetworkError as error:
        raise _fail(error) from error


@router.post("/requests/{connection_id}/decline", response_model=ConnectionRecord)
def decline_request(
    connection_id: int, session: DatabaseSession, user: CurrentUser
) -> ConnectionRecord:
    try:
        return service.respond(session, user, connection_id, accept=False)
    except service.NetworkError as error:
        raise _fail(error) from error


@router.delete("/requests/{connection_id}", status_code=status.HTTP_204_NO_CONTENT)
def withdraw_request(connection_id: int, session: DatabaseSession, user: CurrentUser) -> None:
    try:
        service.withdraw(session, user, connection_id)
    except service.NetworkError as error:
        raise _fail(error) from error


@router.delete("/connections/{connection_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_connection(connection_id: int, session: DatabaseSession, user: CurrentUser) -> None:
    try:
        service.disconnect(session, user, connection_id)
    except service.NetworkError as error:
        raise _fail(error) from error


@router.get("/me", response_model=PersonCard)
def my_card(user: CurrentUser) -> PersonCard:
    return service.card_of(user, standing="self")


@router.patch("/me", response_model=PersonCard)
def edit_card(
    payload: ProfileCard, session: DatabaseSession, user: CurrentUser
) -> PersonCard:
    try:
        updated = service.update_card(session, user, **payload.model_dump(exclude_none=True))
    except service.NetworkError as error:
        raise _fail(error) from error
    return service.card_of(updated, standing="self")
