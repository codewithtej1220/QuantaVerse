from __future__ import annotations

from datetime import date, datetime, timedelta, timezone


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is not None:
        return value.astimezone(timezone.utc)
    return value.replace(tzinfo=timezone.utc)


def epoch(value: datetime) -> int:
    return int(value.replace(tzinfo=timezone.utc).timestamp())


def today() -> date:
    return utcnow().date()


def days_ago(count: int) -> datetime:
    return utcnow() - timedelta(days=count)
