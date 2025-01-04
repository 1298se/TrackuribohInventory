import asyncio

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from cron.tasks.update_catalog_db import update_card_database
from cron.tasks.download_product_prices import download_product_price_data
import logging

logging.basicConfig()
logging.getLogger('apscheduler').setLevel(logging.DEBUG)

UPDATE_CARD_DATABASE_JOB_FREQUENCY = 6
DOWNLOAD_PRODUCT_PRICE_DATA_JOB_FREQUENCY = 12

scheduler = AsyncIOScheduler(
    job_defaults={'misfire_grace_time': 60},
    timezone="America/New_York",
)


scheduler.add_job(update_card_database, trigger='cron', hour=','.join([f'{i * UPDATE_CARD_DATABASE_JOB_FREQUENCY}' for i in range(24 // UPDATE_CARD_DATABASE_JOB_FREQUENCY)]))  # Schedule to run every day
scheduler.add_job(
    download_product_price_data,
    id="fetch_all_near_mint_listing",
    trigger='cron',
    hour=','.join([f'{i * DOWNLOAD_PRODUCT_PRICE_DATA_JOB_FREQUENCY}' for i in range(24 // DOWNLOAD_PRODUCT_PRICE_DATA_JOB_FREQUENCY)])
)

if __name__ == "__main__":
    scheduler.start()

    asyncio.get_event_loop().run_forever()