from contextlib import asynccontextmanager

from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI

from app.environment import get_environment
from app.routes.transactions.api import router as transactions_router
from app.routes.catalog.api import router as catalog_router
from app.services.tcgplayer_catalog_service import get_tcgplayer_catalog_service
from app.tasks.update_catalog_db import update_card_database

SQLALCHEMY_DATABASE_URL = get_environment().db_url

jobstores = {
    'default': SQLAlchemyJobStore(url=SQLALCHEMY_DATABASE_URL)
}

scheduler = AsyncIOScheduler()

scheduler.add_job(
    update_card_database,
    trigger='cron',
    hour='0,3,6,9,12,15,18,21'
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load the ML model
    scheduler.start()

    tcgplayer_catalog_service = get_tcgplayer_catalog_service()

    await tcgplayer_catalog_service.init()

    # scheduler.add_job(update_card_database)

    yield

    await tcgplayer_catalog_service.close()
    scheduler.shutdown()

app = FastAPI(lifespan=lifespan)
app.include_router(transactions_router)
app.include_router(catalog_router)