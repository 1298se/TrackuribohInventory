from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from models.catalog import Base
from settings import get_environment

SQLALCHEMY_DATABASE_URL = get_environment().db_url

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    echo=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(engine)
