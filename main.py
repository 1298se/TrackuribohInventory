import asyncio

from fastapi import FastAPI

from services.tcgplayer_catalog_service import TCGPlayerCatalogService
from tasks.update_catalog_db import update_card_database

app = FastAPI()

@app.get("/")
async def root():
    return {"message": "Hello World"}


@app.get("/hello/{name}")
async def say_hello(name: str):
    return {"message": f"Hello {name}"}

async def main():
    async with TCGPlayerCatalogService() as service:
        print(await service._check_and_refresh_access_token())


if __name__ == "__main__":
    asyncio.run(update_card_database())