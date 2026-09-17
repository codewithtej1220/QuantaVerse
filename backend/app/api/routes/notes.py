from __future__ import annotations

from urllib.parse import quote

from fastapi import APIRouter, HTTPException, Query, Request, status
from fastapi.responses import FileResponse
from starlette.concurrency import run_in_threadpool

from app.api.deps import CurrentUser, DatabaseSession
from app.core.config import get_settings
from app.models.notes import NoteRecord, NotesResponse
from app.services import notes as service

"""
Module notes.

The upload is the PDF itself as the request body, with the title in the query
string, rather than a multipart form. A form upload would need one more
dependency to parse, for a request that only ever carries one file.
"""

router = APIRouter(prefix="/api/notes", tags=["notes"])


def _fail(error: service.NotesError) -> HTTPException:
    return HTTPException(status_code=error.status, detail=error.message)


@router.get("/{module_slug}", response_model=NotesResponse)
def module_notes(module_slug: str, session: DatabaseSession, user: CurrentUser) -> NotesResponse:
    try:
        notes = service.list_notes(session, module_slug)
    except service.NotesError as error:
        raise _fail(error) from error
    allowed, hint = service.upload_permission(user)
    return NotesResponse(
        module_slug=module_slug,
        notes=[service.record(note, user) for note in notes],
        can_upload=allowed,
        upload_hint=hint,
        max_bytes=get_settings().notes_max_bytes,
    )


@router.post("/{module_slug}", response_model=NoteRecord, status_code=status.HTTP_201_CREATED)
async def upload_note(
    module_slug: str,
    request: Request,
    session: DatabaseSession,
    user: CurrentUser,
    title: str = Query(min_length=1, max_length=140),
    description: str | None = Query(default=None, max_length=300),
    filename: str | None = Query(default=None, max_length=200),
) -> NoteRecord:
    kind = (request.headers.get("content-type") or "").split(";", 1)[0].strip().lower()
    if kind != "application/pdf":
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="send the PDF itself as the request body, with Content-Type: application/pdf",
        )

    # Refused before reading when the client declares a size, and counted while
    # reading when it does not, so an oversized upload is never held in memory.
    limit = get_settings().notes_max_bytes
    too_big = HTTPException(
        # A bare 413: Starlette renamed its constant, and either name is missing
        # from some of the versions requirements.txt allows.
        status_code=413,
        detail=f"that file is over the {limit // (1024 * 1024)} MB limit",
    )
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > limit:
        raise too_big

    chunks: list[bytes] = []
    received = 0
    async for chunk in request.stream():
        received += len(chunk)
        if received > limit:
            raise too_big
        chunks.append(chunk)

    try:
        note = await run_in_threadpool(
            service.save_note,
            session,
            user,
            module_slug,
            b"".join(chunks),
            title=title,
            description=description,
            original_name=filename,
        )
    except service.NotesError as error:
        raise _fail(error) from error
    return service.record(note, user)


@router.get("/file/{note_id}", response_class=FileResponse)
def note_file(note_id: int, session: DatabaseSession, user: CurrentUser) -> FileResponse:
    try:
        note, path = service.get_note(session, note_id)
    except service.NotesError as error:
        raise _fail(error) from error
    name = f"{note.title}.pdf"
    return FileResponse(
        path,
        media_type="application/pdf",
        headers={
            # inline, so a browser shows it; the name is for "save as".
            "Content-Disposition": f"inline; filename*=UTF-8''{quote(name)}",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "sandbox",
            "Cache-Control": "private, max-age=300",
        },
    )


@router.delete("/file/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_note(note_id: int, session: DatabaseSession, user: CurrentUser) -> None:
    try:
        service.delete_note(session, user, note_id)
    except service.NotesError as error:
        raise _fail(error) from error
