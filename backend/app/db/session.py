from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from functools import lru_cache
from pathlib import Path
from typing import Any

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import get_settings
from app.db.models import Base


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    settings = get_settings()
    url = settings.database_url
    options: dict[str, object] = {
        "echo": settings.database_echo,
        "future": True,
        "pool_pre_ping": True,
    }

    if url.startswith("sqlite"):
        options["connect_args"] = {"check_same_thread": False, "timeout": 15}
        if ":memory:" in url or url.endswith("sqlite://"):
            options["poolclass"] = StaticPool
        else:
            target = url.split("///", 1)[-1]
            if target:
                Path(target).expanduser().parent.mkdir(parents=True, exist_ok=True)

    engine = create_engine(url, **options)

    if engine.dialect.name == "sqlite":

        @event.listens_for(engine, "connect")
        def _sqlite_pragmas(connection: Any, record: Any) -> None:
            cursor = connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA synchronous=NORMAL")
            cursor.close()

    return engine


@lru_cache(maxsize=1)
def get_session_factory() -> sessionmaker[Session]:
    return sessionmaker(
        bind=get_engine(), autoflush=False, autocommit=False, expire_on_commit=False
    )


def init_db() -> None:
    Base.metadata.create_all(bind=get_engine())


def get_session() -> Iterator[Session]:
    session = get_session_factory()()
    try:
        yield session
    finally:
        session.close()


@contextmanager
def session_scope() -> Iterator[Session]:
    session = get_session_factory()()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def database_status() -> dict[str, object]:
    settings = get_settings()
    engine = get_engine()
    location = engine.url.database or "memory"
    return {
        "kind": settings.database_kind,
        "location": location,
        "tables": sorted(Base.metadata.tables),
    }
