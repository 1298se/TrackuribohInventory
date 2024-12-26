import asyncio

from src.update_catalog_db import update_card_database


def handler(event, context):
    if event["job"] == "sync_catalog":
        asyncio.run(
            update_card_database()
        )
