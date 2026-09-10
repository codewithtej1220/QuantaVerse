from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from functools import lru_cache
from pathlib import Path
from typing import Any

from sqlalchemy import Engine, create_engine, event, inspect, text
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


def _add_missing_columns(engine: Engine) -> list[str]:
    """
    Bring an existing table up to the models it is meant to match.

    `create_all` creates tables it cannot find and then leaves the ones it can
    entirely alone, so a column added to a model never reaches a database that
    already has that table. Every developer with a `quantaverse.db` from last
    week — and the deployed instance — would get `no such column: users.role`
    on the first request touching the research hub.

    This is not a migration system and does not pretend to be one: it only ever
    adds a nullable-or-defaulted column, which is the one schema change that is
    safe to infer and to run twice. Renames, drops and type changes want Alembic
    and a human. Anything it cannot express is left for that.
    """
    inspector = inspect(engine)
    added: list[str] = []

    for name, table in Base.metadata.tables.items():
        if not inspector.has_table(name):
            continue
        present = {column["name"] for column in inspector.get_columns(name)}

        for column in table.columns:
            if column.name in present:
                continue
            # Only the safe shape: something every existing row can be given.
            if not column.nullable and column.server_default is None and column.default is None:
                continue

            kind = column.type.compile(dialect=engine.dialect)
            clause = f"ALTER TABLE {name} ADD COLUMN {column.name} {kind}"

            default = column.default
            if default is not None and not default.is_callable and default.arg is not None:
                literal = default.arg
                if isinstance(literal, bool):
                    clause += f" DEFAULT {1 if literal else 0}"
                elif isinstance(literal, (int, float)):
                    clause += f" DEFAULT {literal}"
                elif isinstance(literal, str):
                    escaped = literal.replace("'", "''")
                    clause += f" DEFAULT '{escaped}'"
                if not column.nullable:
                    clause += " NOT NULL"

            with engine.begin() as connection:
                connection.execute(text(clause))
            added.append(f"{name}.{column.name}")

    return added


def init_db() -> None:
    engine = get_engine()
    Base.metadata.create_all(bind=engine)
    _add_missing_columns(engine)


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
