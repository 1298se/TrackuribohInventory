from sqlalchemy import create_engine, inspect
from sqlalchemy.dialects.postgresql import insert, Insert
from sqlalchemy.orm import sessionmaker, Session
from typing_extensions import Type
from typing import Generator

from core.environment import Env, get_environment
from core.models.base import Base

SQLALCHEMY_DATABASE_URL = get_environment().db_url
DATABASE_POOL_SIZE = 50
MAX_OVERFLOW = 5

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_size=DATABASE_POOL_SIZE,
    max_overflow=MAX_OVERFLOW,
    pool_pre_ping=True,
    pool_timeout=120,
    echo=get_environment().env == Env.DEBUG,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def upsert(model: Type[Base], values: list[dict], index_elements=None) -> Insert:
    insert_stmt = insert(model).values(values)
    inspector = inspect(model)

    primary_keys = [col.name for col in inspector.primary_key]

    # Exclude generated/computed columns (e.g., search_vector) from the update set
    table_columns = inspect(model).columns
    updatable_cols = {
        c.name: c
        for c in insert_stmt.excluded
        if c.name not in primary_keys and not table_columns[c.name].computed
    }

    return insert_stmt.on_conflict_do_update(
        index_elements=primary_keys if index_elements is None else index_elements,
        set_=updatable_cols,
    )


def get_db_session() -> Generator[Session, None, None]:
    """
    Get a database session. You must explicitly begin/commit/rollback transactions.
    """
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
