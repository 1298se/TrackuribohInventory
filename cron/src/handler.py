import asyncio

from src.update_catalog_db import update_card_database

from src.update_product_prices import update_product_prices


def handler(event, context):
    match event["job"]:
        case "sync_catalog":
            asyncio.run(
                update_card_database()
            )

        case "download_product_prices":
            asyncio.run(
                update_product_prices()
            )
