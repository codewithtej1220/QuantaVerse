from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

"""
Wire shapes for module notes.

A note is shown to every signed-in member, so it carries who uploaded it the
way the research hub shows a person, by name, handle and institution, and never
by e-mail address.
"""


class NoteUploader(BaseModel):
    display_name: str
    handle: str
    institution: str | None = None
    position: str | None = None


class NoteRecord(BaseModel):
    id: int
    module_slug: str
    title: str
    description: str | None = None
    # The name the file had on the uploader's machine, shown so a professor can
    # recognise their own upload. Never used as a path.
    original_name: str | None = None
    size_bytes: int
    pages: int | None = None
    uploaded_at: datetime
    uploader: NoteUploader
    # Whether the person asking uploaded it, so the client can offer to delete
    # it without comparing ids itself.
    mine: bool = False


class NotesResponse(BaseModel):
    module_slug: str
    notes: list[NoteRecord]
    # Whether the person asking may upload to this module, and if not, a
    # sentence saying why, so the client never shows an upload control that
    # would only fail.
    can_upload: bool
    upload_hint: str | None = None
    max_bytes: int
