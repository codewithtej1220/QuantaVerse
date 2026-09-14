from __future__ import annotations

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.clock import utcnow
from app.db.models import Connection, EarnedBadge, LessonCompletion, User
from app.models.network import ConnectionRecord, PersonCard

"""
The research hub's connection graph.

The rules are the ones every professional network converges on, and they are
here rather than in the route because three of them are easy to get subtly
wrong and each one is a real hole:

  * Only the addressee may accept or decline. Otherwise a requester accepts
    their own request and the graph means nothing.
  * Only the requester may withdraw. Otherwise declining and withdrawing are
    the same button and the audit trail is a lie.
  * A pending request in the opposite direction is an acceptance, not a
    conflict. Two people who each asked first have already agreed.

Progress figures are attached only for people you are connected to, because a
directory that shows strangers how far behind you are is a leaderboard nobody
asked to be on.
"""

MAX_PENDING_SENT = 50
DIRECTORY_LIMIT = 60


class NetworkError(Exception):
    """Something the person asking can fix, phrased for them."""

    def __init__(self, message: str, status: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status = status


def split_interests(raw: str | None) -> list[str]:
    if not raw:
        return []
    return [chunk.strip() for chunk in raw.split(",") if chunk.strip()][:8]


def _edges_of(session: Session, viewer: User) -> dict[int, Connection]:
    """
    Every connection row the viewer is party to, keyed by the other person.

    One query, so rendering a directory page of sixty people does not become
    sixty lookups. Where both directions exist the accepted one wins — being
    connected is a stronger fact about the pair than either pending ask.
    """
    rows = session.scalars(
        select(Connection).where(
            or_(Connection.requester_id == viewer.id, Connection.addressee_id == viewer.id)
        )
    ).all()

    edges: dict[int, Connection] = {}
    for row in rows:
        other = row.addressee_id if row.requester_id == viewer.id else row.requester_id
        held = edges.get(other)
        if held is None or (row.status == "accepted" and held.status != "accepted"):
            edges[other] = row
    return edges


def standing_of(viewer: User, other: User, edge: Connection | None) -> str:
    if other.id == viewer.id:
        return "self"
    if edge is None:
        return "none"
    if edge.status == "accepted":
        return "connected"
    if edge.status == "declined":
        return "declined"
    return "awaiting_them" if edge.requester_id == viewer.id else "awaiting_you"


def _progress_of(session: Session, user_ids: list[int]) -> dict[int, tuple[int, int]]:
    """Lessons finished and badges earned, for connected people only."""
    if not user_ids:
        return {}

    lessons = dict(
        session.execute(
            select(LessonCompletion.user_id, func.count())
            .where(LessonCompletion.user_id.in_(user_ids))
            .group_by(LessonCompletion.user_id)
        ).all()
    )
    badges = dict(
        session.execute(
            select(EarnedBadge.user_id, func.count())
            .where(EarnedBadge.user_id.in_(user_ids))
            .group_by(EarnedBadge.user_id)
        ).all()
    )
    return {uid: (int(lessons.get(uid, 0)), int(badges.get(uid, 0))) for uid in user_ids}


def card_of(
    user: User,
    *,
    standing: str = "none",
    connection_id: int | None = None,
    progress: tuple[int, int] | None = None,
) -> PersonCard:
    return PersonCard(
        id=user.id,
        handle=user.handle,
        display_name=user.display_name,
        role=user.role if user.role in {"student", "mentor"} else "student",
        institution=user.institution,
        headline=user.headline,
        interests=split_interests(user.interests),
        open_to_mentoring=bool(user.open_to_mentoring),
        position=user.position,
        education=user.education,
        focus=user.focus,
        mentoring=user.mentoring,
        availability=user.availability,
        is_demo=bool(user.is_demo),
        avatar_url=user.avatar_url,
        joined_at=user.created_at,
        standing=standing,  # type: ignore[arg-type]
        connection_id=connection_id,
        modules_completed=progress[0] if progress else None,
        badges_earned=progress[1] if progress else None,
    )


def directory(
    session: Session,
    viewer: User,
    *,
    query: str | None = None,
    role: str | None = None,
    mentors_only: bool = False,
    limit: int = DIRECTORY_LIMIT,
) -> tuple[list[PersonCard], int]:
    statement = select(User).where(User.is_active.is_(True))

    if role in {"student", "mentor"}:
        statement = statement.where(User.role == role)
    if mentors_only:
        statement = statement.where(User.open_to_mentoring.is_(True))

    if query:
        needle = f"%{query.strip().lower()}%"
        statement = statement.where(
            or_(
                func.lower(User.display_name).like(needle),
                func.lower(User.handle).like(needle),
                func.lower(func.coalesce(User.institution, "")).like(needle),
                func.lower(func.coalesce(User.headline, "")).like(needle),
                func.lower(func.coalesce(User.interests, "")).like(needle),
            )
        )

    total = int(session.scalar(select(func.count()).select_from(statement.subquery())) or 0)

    # Mentors offering time first, then mentors, then whoever joined most
    # recently — a directory that opens on the people you came here for.
    rows = session.scalars(
        statement.order_by(
            User.open_to_mentoring.desc(), User.role.desc(), User.created_at.desc()
        ).limit(limit)
    ).all()

    edges = _edges_of(session, viewer)
    connected = [
        row.id
        for row in rows
        if (edge := edges.get(row.id)) is not None and edge.status == "accepted"
    ]
    progress = _progress_of(session, connected)

    cards = []
    for row in rows:
        edge = edges.get(row.id)
        cards.append(
            card_of(
                row,
                standing=standing_of(viewer, row, edge),
                connection_id=edge.id if edge else None,
                progress=progress.get(row.id),
            )
        )
    return cards, total


def _record(session: Session, viewer: User, row: Connection) -> ConnectionRecord:
    outgoing = row.requester_id == viewer.id
    other = row.addressee if outgoing else row.requester
    progress = None
    if row.status == "accepted":
        progress = _progress_of(session, [other.id]).get(other.id)

    return ConnectionRecord(
        id=row.id,
        status=row.status,  # type: ignore[arg-type]
        note=row.note,
        created_at=row.created_at,
        responded_at=row.responded_at,
        outgoing=outgoing,
        person=card_of(
            other,
            standing=standing_of(viewer, other, row),
            connection_id=row.id,
            progress=progress,
        ),
    )


def network_of(session: Session, viewer: User) -> dict[str, object]:
    rows = session.scalars(
        select(Connection)
        .where(or_(Connection.requester_id == viewer.id, Connection.addressee_id == viewer.id))
        .order_by(Connection.created_at.desc())
    ).all()

    connections: list[ConnectionRecord] = []
    incoming: list[ConnectionRecord] = []
    outgoing: list[ConnectionRecord] = []

    for row in rows:
        record = _record(session, viewer, row)
        if row.status == "accepted":
            connections.append(record)
        elif row.status == "pending":
            (outgoing if record.outgoing else incoming).append(record)
        elif row.status == "declined" and record.outgoing:
            # A decline is shown to the person who asked as "no answer yet"
            # rather than as a rejection notice. They can see it stalled; they
            # are not handed a rebuff to take personally.
            outgoing.append(record)

    return {
        "connections": connections,
        "incoming": incoming,
        "outgoing": outgoing,
        "pending_incoming": len(incoming),
    }


def request_connection(
    session: Session, viewer: User, *, handle: str, note: str | None
) -> ConnectionRecord:
    target = session.scalars(
        select(User).where(func.lower(User.handle) == handle.strip().lower())
    ).first()

    if target is None or not target.is_active:
        raise NetworkError("no member with that handle", status=404)
    if target.id == viewer.id:
        raise NetworkError("you are already yourself")

    mine = session.scalars(
        select(Connection).where(
            Connection.requester_id == viewer.id, Connection.addressee_id == target.id
        )
    ).first()
    theirs = session.scalars(
        select(Connection).where(
            Connection.requester_id == target.id, Connection.addressee_id == viewer.id
        )
    ).first()

    if (mine and mine.status == "accepted") or (theirs and theirs.status == "accepted"):
        raise NetworkError("you are already connected", status=409)

    if theirs is not None and theirs.status == "pending":
        # They asked first. Asking back is agreement, so take it as one rather
        # than leaving two requests pointing at each other forever.
        theirs.status = "accepted"
        theirs.responded_at = utcnow()
        session.commit()
        session.refresh(theirs)
        return _record(session, viewer, theirs)

    if mine is not None:
        if mine.status == "pending":
            raise NetworkError("that request is already waiting for them", status=409)
        # Declined once. Let it be asked again — people change their minds, and
        # the row is reused so the history stays one row per direction.
        mine.status = "pending"
        mine.note = note
        mine.created_at = utcnow()
        mine.responded_at = None
        session.commit()
        session.refresh(mine)
        return _record(session, viewer, mine)

    waiting = int(
        session.scalar(
            select(func.count())
            .select_from(Connection)
            .where(Connection.requester_id == viewer.id, Connection.status == "pending")
        )
        or 0
    )
    if waiting >= MAX_PENDING_SENT:
        raise NetworkError(
            f"you have {waiting} requests still waiting — give those a chance first",
            status=429,
        )

    row = Connection(
        requester_id=viewer.id, addressee_id=target.id, status="pending", note=note
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return _record(session, viewer, row)


def _own(session: Session, connection_id: int) -> Connection:
    row = session.get(Connection, connection_id)
    if row is None:
        raise NetworkError("no such request", status=404)
    return row


def respond(
    session: Session, viewer: User, connection_id: int, *, accept: bool
) -> ConnectionRecord:
    row = _own(session, connection_id)
    if row.addressee_id != viewer.id:
        # Deliberately the same message as a missing row: a stranger probing
        # ids should not learn which ones exist.
        raise NetworkError("no such request", status=404)
    if row.status != "pending":
        raise NetworkError(f"that request was already {row.status}", status=409)

    row.status = "accepted" if accept else "declined"
    row.responded_at = utcnow()
    session.commit()
    session.refresh(row)
    return _record(session, viewer, row)


def withdraw(session: Session, viewer: User, connection_id: int) -> None:
    row = _own(session, connection_id)
    if row.requester_id != viewer.id:
        raise NetworkError("no such request", status=404)
    if row.status == "accepted":
        raise NetworkError("that one was accepted — remove the connection instead", status=409)

    session.delete(row)
    session.commit()


def disconnect(session: Session, viewer: User, connection_id: int) -> None:
    row = _own(session, connection_id)
    if viewer.id not in {row.requester_id, row.addressee_id}:
        raise NetworkError("no such connection", status=404)
    session.delete(row)
    session.commit()


def update_card(session: Session, viewer: User, **fields: object) -> User:
    for name in ("role", "headline", "interests", "open_to_mentoring"):
        value = fields.get(name)
        if value is None:
            continue
        if name == "role" and value not in {"student", "mentor"}:
            raise NetworkError("role must be student or mentor")
        setattr(viewer, name, value)

    session.commit()
    session.refresh(viewer)
    return viewer
