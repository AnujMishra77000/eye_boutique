from __future__ import annotations

from collections.abc import Generator
from typing import Any

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings


def _build_engine_kwargs(database_uri: str) -> dict[str, Any]:
    kwargs: dict[str, Any] = {"future": True}

    if database_uri.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
    else:
        kwargs["pool_pre_ping"] = True

    return kwargs


engine = create_engine(
    settings.sqlalchemy_database_uri,
    **_build_engine_kwargs(settings.sqlalchemy_database_uri),
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    future=True,
)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
