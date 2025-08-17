from contextlib import asynccontextmanager

from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from core.environment import get_environment
from app.routes.auth.api import router as auth_router
from app.routes.transactions.api import router as transactions_router
from app.routes.catalog.api import router as catalog_router
from app.routes.inventory.api import router as inventory_router
from core.services.tcgplayer_catalog_service import get_tcgplayer_catalog_service

SQLALCHEMY_DATABASE_URL = get_environment().db_url

jobstores = {"default": SQLAlchemyJobStore(url=SQLALCHEMY_DATABASE_URL)}


@asynccontextmanager
async def lifespan(app: FastAPI):
    tcgplayer_catalog_service = get_tcgplayer_catalog_service()

    await tcgplayer_catalog_service.init()

    # scheduler.add_job(update_card_database)

    yield

    await tcgplayer_catalog_service.close()


app = FastAPI(lifespan=lifespan)

# Configure CORS
env = get_environment()
app.add_middleware(
    CORSMiddleware,
    allow_origins=env.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
)

# Include routers
app.include_router(auth_router)
app.include_router(transactions_router)
app.include_router(catalog_router)
app.include_router(inventory_router)
