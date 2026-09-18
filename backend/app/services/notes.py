from __future__ import annotations

import hashlib
import os
import re
import secrets
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import get_settings
from app.core.curriculum import MODULE_BY_SLUG
from app.db.models import ModuleNote, User
from app.models.notes import NoteRecord, NoteUploader
from app.services import teaching

"""
Module notes: PDFs a professor uploads for students to read instead of, or as
well as, the lesson videos.

Uploading is limited to professors, into the modules they teach, and
optionally to a named list of e-mail addresses (QUANTAVERSE_NOTES_UPLOADERS).
Reading needs any account. A directory of uploads with names and institutions
on it is no more public than the research hub it borrows those from, and a
course site should not become an open file host.

A file has to look like a PDF to be kept: it must start with the PDF header and
end with the end-of-file marker. That is not a guarantee of a well-formed PDF,
and it is not meant to be one. It stops the ordinary accidents — a .docx
renamed, an HTML error page saved as .pdf — and the client always hands the
browser the bytes labelled as application/pdf, so nothing uploaded is ever
treated as a web page.
"""

PDF_HEADER = b"%PDF-"
PDF_TRAILER = b"%%EOF"
# Per uploader, per module. Generous for a course, and a ceiling on what one
# account can pile onto a disk.
MAX_NOTES_PER_MODULE = 20

_CONTROL = re.compile(r"[\x00-\x1f\x7f]")
_PAGE = re.compile(rb"/Type\s*/Page(?![a-zA-Z])")


class NotesError(Exception):
    """Something the person asking can fix, phrased for them."""

    def __init__(self, message: str, status: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status = status


def _tidy(value: str | None, limit: int) -> str | None:
    if value is None:
        return None
    collapsed = " ".join(_CONTROL.sub(" ", value).split())
    return collapsed[:limit] or None


def _module(slug: str) -> None:
    if slug not in MODULE_BY_SLUG:
        raise NotesError("there is no module with that name", status=404)


def upload_permission(session: Session, user: User, module_slug: str) -> tuple[bool, str | None]:
    """Whether `user` may upload notes to a module, and if not, why — in their terms."""
    settings = get_settings()
    if user.role != "professor":
        return False, "Notes are uploaded by the professors who teach this module."
    if not teaching.teaches(session, user, module_slug):
        return False, "Add this module to the ones you teach to upload notes for it."
    if settings.notes_uploaders and user.email.lower() not in settings.notes_uploaders:
        return False, "This site only accepts notes from its listed teaching staff."
    return True, None


def record(note: ModuleNote, viewer: User) -> NoteRecord:
    uploader = note.uploader
    return NoteRecord(
        id=note.id,
        module_slug=note.module_slug,
        title=note.title,
        description=note.description,
        original_name=note.original_name,
        size_bytes=note.size_bytes,
        pages=note.pages,
        uploaded_at=note.created_at,
        uploader=NoteUploader(
            display_name=uploader.display_name,
            handle=uploader.handle,
            institution=uploader.institution,
            position=uploader.position,
        ),
        mine=note.uploader_id == viewer.id,
    )


def list_notes(session: Session, module_slug: str) -> list[ModuleNote]:
    _module(module_slug)
    statement = (
        select(ModuleNote)
        .where(ModuleNote.module_slug == module_slug)
        .options(selectinload(ModuleNote.uploader))
        .order_by(ModuleNote.created_at.desc(), ModuleNote.id.desc())
    )
    return list(session.scalars(statement))


def _count_pages(body: bytes) -> int | None:
    """
    Pages, where they can be counted from the raw bytes.

    PDFs that pack their objects into compressed streams hide the page
    dictionaries from a byte scan, and then the count comes back as zero. Zero
    is never a real answer for a PDF, so it becomes None rather than a wrong
    number.
    """
    pages = len(_PAGE.findall(body))
    return pages or None


def looks_like_pdf(body: bytes) -> bool:
    return body[:1024].find(PDF_HEADER) != -1 and body[-2048:].find(PDF_TRAILER) != -1


def save_note(
    session: Session,
    uploader: User,
    module_slug: str,
    body: bytes,
    *,
    title: str,
    description: str | None = None,
    original_name: str | None = None,
) -> ModuleNote:
    settings = get_settings()
    _module(module_slug)

    allowed, reason = upload_permission(session, uploader, module_slug)
    if not allowed:
        raise NotesError(reason or "you cannot upload notes", status=403)

    clean_title = _tidy(title, 140)
    if not clean_title:
        raise NotesError("give the notes a title")
    clean_description = _tidy(description, 300)
    # Only the last path component, and only for display.
    clean_name = _tidy(re.split(r"[\\/]", original_name or "")[-1], 200)

    if not body:
        raise NotesError("that file is empty")
    if len(body) > settings.notes_max_bytes:
        raise NotesError(
            f"that file is over the {settings.notes_max_bytes // (1024 * 1024)} MB limit",
            status=413,
        )
    if not looks_like_pdf(body):
        raise NotesError("that file is not a PDF — export or print the notes to PDF first", status=415)

    existing = session.scalar(
        select(func.count())
        .select_from(ModuleNote)
        .where(ModuleNote.uploader_id == uploader.id, ModuleNote.module_slug == module_slug)
    )
    if (existing or 0) >= MAX_NOTES_PER_MODULE:
        raise NotesError(
            f"you already have {MAX_NOTES_PER_MODULE} notes on this module — delete one first",
            status=409,
        )

    digest = hashlib.sha256(body).hexdigest()
    duplicate = session.scalar(
        select(ModuleNote.id).where(
            ModuleNote.uploader_id == uploader.id,
            ModuleNote.module_slug == module_slug,
            ModuleNote.sha256 == digest,
        )
    )
    if duplicate is not None:
        raise NotesError("you have already uploaded this file to this module", status=409)

    directory = settings.notes_dir
    directory.mkdir(parents=True, exist_ok=True)
    stored_name = f"{secrets.token_hex(16)}.pdf"
    target = directory / stored_name
    partial = directory / f"{stored_name}.part"
    # Written aside and moved into place, so a request that dies halfway never
    # leaves a truncated PDF behind under a name the database points at.
    partial.write_bytes(body)
    os.replace(partial, target)

    note = ModuleNote(
        module_slug=module_slug,
        uploader_id=uploader.id,
        title=clean_title,
        description=clean_description,
        original_name=clean_name,
        stored_name=stored_name,
        size_bytes=len(body),
        pages=_count_pages(body),
        sha256=digest,
    )
    session.add(note)
    try:
        session.commit()
    except Exception:
        session.rollback()
        target.unlink(missing_ok=True)
        raise
    session.refresh(note)
    return note


def get_note(session: Session, note_id: int) -> tuple[ModuleNote, Path]:
    note = session.get(ModuleNote, note_id)
    if note is None:
        raise NotesError("those notes no longer exist", status=404)
    path = get_settings().notes_dir / note.stored_name
    if not path.is_file():
        raise NotesError("the file for those notes is missing on the server", status=410)
    return note, path


def delete_note(session: Session, user: User, note_id: int) -> None:
    note = session.get(ModuleNote, note_id)
    if note is None:
        raise NotesError("those notes no longer exist", status=404)
    if note.uploader_id != user.id:
        raise NotesError("only the person who uploaded notes can delete them", status=403)
    path = get_settings().notes_dir / note.stored_name
    session.delete(note)
    session.commit()
    path.unlink(missing_ok=True)
