from contextlib import asynccontextmanager

from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from fastapi import FastAPI

from core.environment import get_environment
from src.routes.transactions.api import router as transactions_router
from src.routes.catalog.api import router as catalog_router
from core.services.tcgplayer_catalog_service import get_tcgplayer_catalog_service

SQLALCHEMY_DATABASE_URL = get_environment().db_url

jobstores = {
    'default': SQLAlchemyJobStore(url=SQLALCHEMY_DATABASE_URL)
}

@asynccontextmanager
async def lifespan(app: FastAPI):
    tcgplayer_catalog_service = get_tcgplayer_catalog_service()

    await tcgplayer_catalog_service.init()

    # scheduler.add_job(update_card_database)

    yield

    await tcgplayer_catalog_service.close()

app = FastAPI(lifespan=lifespan)
app.include_router(transactions_router)
app.include_router(catalog_router)