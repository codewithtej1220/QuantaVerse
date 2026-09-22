from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import delete, select

from app.api.deps import CurrentUser, DatabaseSession
from app.db.models import LessonCompletion, OwnModule, User
from app.models.teaching import OwnModuleCard, OwnModuleView
from app.services import own_modules as service

"""
A professor's own modules, from the student's side.

The professor writes them on the teaching page; these are the routes a student
takes one through — the list of what their professors have published, one
module in full, and ticking its lessons. A lab on one is graded by the ordinary
grade endpoint, with the module's slug as the lab's name.
"""

router = APIRouter(prefix="/api/own-modules", tags=["teaching"])


def _visible(session: DatabaseSession, user: User, slug: str) -> OwnModule:
    module = service.find(session, slug)
    if module is None or not service.can_view(session, user, module):
        # The same answer whether it is missing or not theirs to see, so a
        # slug cannot be probed for.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="that module is not one of your professors'",
        )
    return module


@router.get("", response_model=list[OwnModuleCard])
def my_professors_modules(session: DatabaseSession, user: CurrentUser) -> list[OwnModuleCard]:
    """What the viewer's professors have published for them, with their progress."""
    return service.cards_for(session, user)


@router.get("/{slug}", response_model=OwnModuleView)
def one_module(slug: str, session: DatabaseSession, user: CurrentUser) -> OwnModuleView:
    return service.view(session, user, _visible(session, user, slug))


@router.post("/{slug}/lessons/{index}", response_model=OwnModuleView)
def mark_lesson(
    slug: str, index: int, session: DatabaseSession, user: CurrentUser
) -> OwnModuleView:
    module = _visible(session, user, slug)
    if not 0 <= index < service.lesson_count(module):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{module.title} has no lesson {index + 1}",
        )
    exists = session.scalar(
        select(LessonCompletion.id).where(
            LessonCompletion.user_id == user.id,
            LessonCompletion.module_slug == module.slug,
            LessonCompletion.lesson_index == index,
        )
    )
    if exists is None:
        session.add(LessonCompletion(user_id=user.id, module_slug=module.slug, lesson_index=index))
        session.commit()
    return service.view(session, user, module)


@router.delete("/{slug}/lessons/{index}", response_model=OwnModuleView)
def unmark_lesson(
    slug: str, index: int, session: DatabaseSession, user: CurrentUser
) -> OwnModuleView:
    module = _visible(session, user, slug)
    session.execute(
        delete(LessonCompletion).where(
            LessonCompletion.user_id == user.id,
            LessonCompletion.module_slug == module.slug,
            LessonCompletion.lesson_index == index,
        )
    )
    session.commit()
    return service.view(session, user, module)
