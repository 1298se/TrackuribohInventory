from core.database import SessionLocal
from core.models.catalog import Product
from sqlalchemy.orm import joinedload
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def backfill_product_search_metadata():
    session = SessionLocal()
    try:
        logger.info(
            "Starting backfill of product search metadata using ORM in batches..."
        )

        # Step 1: Fetch all product IDs to be processed
        logger.info("Fetching all product IDs...")
        product_ids = [pid[0] for pid in session.query(Product.id).all()]
        total_products = len(product_ids)
        logger.info(f"Found {total_products} products to process.")

        batch_size = 1000
        total_updated_count = 0

        for i in range(0, total_products, batch_size):
            batch_ids = product_ids[i : i + batch_size]
            batch_num = (i // batch_size) + 1
            logger.info(
                f"Processing batch {batch_num} (products {i + 1}-{min(i + batch_size, total_products)} of {total_products})..."
            )

            # Step 2: Fetch products for the current batch
            products_in_batch = (
                session.query(Product)
                .filter(Product.id.in_(batch_ids))
                .options(joinedload(Product.set))
                .all()
            )

            batch_updated_count = 0
            for product in products_in_batch:
                data = product.data or []
                rarity = next(
                    (
                        item.get("value")
                        for item in data
                        if item.get("name") == "Rarity"
                    ),
                    None,
                )
                number = next(
                    (
                        item.get("value")
                        for item in data
                        if item.get("name") == "Number"
                    ),
                    None,
                )
                set_name = product.set.name if product.set else None

                if (
                    product.rarity != rarity
                    or product.number != number
                    or product.set_name != set_name
                ):
                    product.rarity = rarity
                    product.number = number
                    product.set_name = set_name
                    batch_updated_count += 1

            if batch_updated_count > 0:
                session.commit()
                logger.info(
                    f"Batch {batch_num} committed. Updated {batch_updated_count} products in this batch."
                )
            else:
                session.rollback()  # Rollback if no changes to release resources, though commit would also do this.
                logger.info(f"Batch {batch_num} processed. No changes in this batch.")
            total_updated_count += batch_updated_count

        logger.info(
            f"Backfill completed. Total updated products: {total_updated_count}."
        )
    except Exception:
        logger.exception("Error during backfill.")
        session.rollback()
    finally:
        session.close()


if __name__ == "__main__":
    backfill_product_search_metadata()
