import uuid

from sqlalchemy import Select, select, func, and_

from core.models import SKUPriceSnapshot, SKUPriceSnapshotJob


def query_latest_sku_prices() -> Select:
    # Subquery to get the latest job_id for each SKU
    latest_job_ids_for_sku_ids = (
        select(
            SKUPriceSnapshot.sku_id,
            func.max(SKUPriceSnapshot.job_id).label("latest_job_id"),
        )
        .join(SKUPriceSnapshotJob)
        .group_by(SKUPriceSnapshot.sku_id)
    ).subquery()

    # Main query to get the prices
    return (
        select(
            SKUPriceSnapshot
        )
        .join(
            latest_job_ids_for_sku_ids,
            and_(
                SKUPriceSnapshot.sku_id == latest_job_ids_for_sku_ids.c.sku_id,
                SKUPriceSnapshot.job_id == latest_job_ids_for_sku_ids.c.latest_job_id
            )
        )
    )
