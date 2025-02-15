from sqlalchemy import create_engine, inspect
from sqlalchemy.dialects.postgresql import insert, Insert
from sqlalchemy.orm import sessionmaker, Session
from typing_extensions import Type

from core.environment import Env, get_environment
from core.models import Base

SQLALCHEMY_DATABASE_URL = get_environment().db_url
DATABASE_POOL_SIZE = 100

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_size=DATABASE_POOL_SIZE,
    pool_timeout=120,
    echo=get_environment().env == Env.DEBUG
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(engine)

def upsert(model: Type[Base], values: list[dict], index_elements=None) -> Insert:
    insert_stmt = insert(model).values(values)
    inspector = inspect(model)

    primary_keys = [col.name for col in inspector.primary_key]

    return insert_stmt.on_conflict_do_update(
        index_elements=primary_keys if index_elements is None else index_elements,
        set_={c.name: c for c in insert_stmt.excluded if c.name not in primary_keys}
    )

def get_db_session() -> Session:
    """
    You should still explicitly commit
    :return:
    """
    with SessionLocal() as session:
        yield session
