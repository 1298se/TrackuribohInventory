import asyncio
import logging
import uuid
from dataclasses import dataclass
from datetime import timezone

from sqlalchemy import select

from core.database import SessionLocal, upsert
from core.models.catalog import (
    Catalog,
    Condition,
    Language,
    Printing,
    Product,
    SKU,
    Set,
)
from core.services.schemas.schema import (
    CatalogSetSchema,
    TCGPlayerProductType,
    map_tcgplayer_product_type_to_product_type,
)
from core.services.tcgplayer_catalog_service import (
    TCGPlayerCatalogService,
    tcgplayer_service_context,
)
from core.utils.workers import process_task_queue
from cron.telemetry import init_sentry

init_sentry("update_catalog_db")

# Configure logging
logging.basicConfig(
    level=logging.DEBUG, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


JOB_NAME = "update_catalog_db"

PAGINATION_SIZE = 100

SUPPORTED_CATALOGS = frozenset(
    # YuGiOh, Pokemon, Pokemon Japan
    [2, 3, 85]
)


@dataclass
class CatalogMappings:
    """Container for TCGPlayer ID to database ID mappings for a catalog."""

    printing: dict[int, uuid.UUID]  # TCGPlayer printing ID to database ID mapping
    condition: dict[int, uuid.UUID]  # TCGPlayer condition ID to database ID mapping
    language: dict[int, uuid.UUID]  # TCGPlayer language ID to database ID mapping


async def update_set(
    service: TCGPlayerCatalogService,
    tcgplayer_set: CatalogSetSchema,
    catalog_id: uuid.UUID,
    printing_tcgplayer_id_to_id_mapping: dict[int, uuid.UUID],
    condition_tcgplayer_id_to_id_mapping: dict[int, uuid.UUID],
    language_tcgplayer_id_to_id_mapping: dict[int, uuid.UUID],
):
    with SessionLocal() as session, session.begin():
        current_set_id = session.scalars(
            upsert(
                model=Set,
                values=[
                    {
                        "tcgplayer_id": tcgplayer_set.tcgplayer_id,
                        "name": tcgplayer_set.name,
                        "code": tcgplayer_set.abbreviation,
                        "release_date": tcgplayer_set.published_on,
                        "modified_date": tcgplayer_set.modified_on,
                        "catalog_id": catalog_id,
                    }
                ],
                index_elements=[Set.tcgplayer_id],
            ).returning(Set.id)
        ).one()

        for tcgplayer_product_type in TCGPlayerProductType:
            product_type = map_tcgplayer_product_type_to_product_type(
                tcgplayer_product_type
            )
            logger.debug(f"Processing product type: {product_type}")

            current_offset = 0
            total = None

            while total is None or current_offset < total:
                logger.debug(
                    f"Processing page for set {current_set_id} - {tcgplayer_set.name} (offset: {current_offset})"
                )
                sets_response = await service.get_products(
                    tcgplayer_set_id=tcgplayer_set.tcgplayer_id,
                    offset=current_offset,
                    limit=PAGINATION_SIZE,
                    product_type=tcgplayer_product_type,
                )

                if "No products were found." in sets_response.errors:
                    logger.debug(
                        f"No products found for product type: {product_type} in set {tcgplayer_set.name}"
                    )
                    break

                current_offset += len(sets_response.results)
                total = (
                    sets_response.total_items
                    if sets_response.total_items is not None
                    else 0
                )
                logger.debug(
                    f"Retrieved {len(sets_response.results)} products, total: {total}"
                )

                product_values = [
                    {
                        "tcgplayer_id": product.tcgplayer_id,
                        "name": product.name,
                        "clean_name": product.clean_name,
                        "image_url": product.image_url,
                        "set_id": current_set_id,
                        "product_type": product_type,
                        "data": product.extended_data,
                        "rarity": next(
                            (
                                item.get("value")
                                for item in product.extended_data
                                if item.get("name") == "Rarity"
                            ),
                            None,
                        ),
                        "number": next(
                            (
                                item.get("value")
                                for item in product.extended_data
                                if item.get("name") == "Number"
                            ),
                            None,
                        ),
                        "set_name": tcgplayer_set.name,
                    }
                    for product in sets_response.results
                ]

                if not product_values:
                    continue

                result = session.execute(
                    upsert(
                        model=Product,
                        values=product_values,
                        index_elements=[Product.tcgplayer_id],
                    ).returning(Product.tcgplayer_id, Product.id)
                )

                product_tcgplayer_id_to_id_mapping = {
                    row.tcgplayer_id: row.id for row in result.all()
                }

                sku_values = [
                    {
                        "tcgplayer_id": sku.tcgplayer_id,
                        "product_id": product_tcgplayer_id_to_id_mapping[
                            sku.tcgplayer_product_id
                        ],
                        "printing_id": printing_tcgplayer_id_to_id_mapping[
                            sku.tcgplayer_printing_id
                        ],
                        "condition_id": condition_tcgplayer_id_to_id_mapping[
                            sku.tcgplayer_condition_id
                        ],
                        "language_id": language_tcgplayer_id_to_id_mapping[
                            sku.tcgplayer_language_id
                        ],
                    }
                    for product in sets_response.results
                    for sku in product.skus
                ]

                if sku_values:
                    session.execute(
                        upsert(
                            model=SKU,
                            values=sku_values,
                            index_elements=[SKU.tcgplayer_id],
                        )
                    )
                    logger.debug(f"Upserted {len(sku_values)} SKUs")


async def fetch_catalog_mappings(
    service: TCGPlayerCatalogService, catalog: Catalog
) -> CatalogMappings:
    """
    Fetches and upserts printings, conditions, and languages for a catalog.

    Args:
        service: The TCGPlayerCatalogService to use for API calls
        catalog: The catalog to fetch mappings for

    Returns:
        A CatalogMappings object containing the mappings between TCGPlayer IDs and database UUIDs:
        - printing: Maps TCGPlayer printing IDs to database UUIDs
        - condition: Maps TCGPlayer condition IDs to database UUIDs
        - language: Maps TCGPlayer language IDs to database UUIDs
    """
    with SessionLocal() as session, session.begin():
        printings_request = service.get_printings(catalog_id=catalog.tcgplayer_id)
        conditions_request = service.get_conditions(catalog_id=catalog.tcgplayer_id)
        languages_request = service.get_languages(catalog_id=catalog.tcgplayer_id)

        # Need to await all requests
        printings_response = await printings_request
        conditions_response = await conditions_request
        languages_response = await languages_request

        printing_values = [
            {
                "tcgplayer_id": printing_detail_response.tcgplayer_id,
                "name": printing_detail_response.name,
                "catalog_id": catalog.id,
            }
            for printing_detail_response in printings_response.results
        ]

        # Use tcgplayer_id alone as the constraint for the printing table
        result = session.execute(
            upsert(
                model=Printing,
                values=printing_values,
                index_elements=[Printing.tcgplayer_id],
            ).returning(Printing.tcgplayer_id, Printing.id)
        ).all()

        printing_tcgplayer_id_to_id_mapping = {
            row.tcgplayer_id: row.id for row in result
        }

        condition_values = [
            {
                "tcgplayer_id": condition_detail_response.tcgplayer_id,
                "name": condition_detail_response.name,
                "abbreviation": condition_detail_response.abbreviation,
            }
            for condition_detail_response in conditions_response.results
        ]

        # Use tcgplayer_id alone as the constraint for the condition table
        result = session.execute(
            upsert(
                model=Condition,
                values=condition_values,
                index_elements=[Condition.tcgplayer_id],
            ).returning(Condition.tcgplayer_id, Condition.id)
        ).all()

        condition_tcgplayer_id_to_id_mapping = {
            row.tcgplayer_id: row.id for row in result
        }

        languages_values = [
            {
                "tcgplayer_id": language_detail_response.tcgplayer_id,
                "name": language_detail_response.name,
                "abbreviation": language_detail_response.abbr,
            }
            for language_detail_response in languages_response.results
        ]

        # Use tcgplayer_id alone as the constraint for the language table
        result = session.execute(
            upsert(
                model=Language,
                values=languages_values,
                index_elements=[Language.tcgplayer_id],
            ).returning(Language.tcgplayer_id, Language.id)
        ).all()

        language_tcgplayer_id_to_id_mapping = {
            row.tcgplayer_id: row.id for row in result
        }

        return CatalogMappings(
            printing=printing_tcgplayer_id_to_id_mapping,
            condition=condition_tcgplayer_id_to_id_mapping,
            language=language_tcgplayer_id_to_id_mapping,
        )


async def update_catalog(service: TCGPlayerCatalogService, catalog: Catalog):
    # Each coroutine should have its own connection to db
    # Fetch and upsert catalog-specific data (printings, conditions, languages)
    mappings = await fetch_catalog_mappings(service, catalog)

    task_queue = asyncio.Queue()
    updated_sets = []
    added_sets = []

    current_offset = 0
    total = None

    while total is None or current_offset < total:
        sets_response = await service.get_sets(
            catalog_id=catalog.tcgplayer_id,
            offset=current_offset,
            limit=PAGINATION_SIZE,
        )

        with SessionLocal() as session:
            sets_response_ids = [
                response.tcgplayer_id for response in sets_response.results
            ]
            existing_sets = session.scalars(
                select(Set).where(Set.tcgplayer_id.in_(sets_response_ids))
            ).all()

            tcgplayer_id_to_existing_set = {
                set.tcgplayer_id: set for set in existing_sets
            }

        total = (
            sets_response.total_items if sets_response.total_items is not None else 0
        )
        current_offset += len(sets_response.results)

        for response_set in sets_response.results:
            existing_set = tcgplayer_id_to_existing_set.get(response_set.tcgplayer_id)

            if (
                existing_set is None
                or response_set.modified_on.replace(tzinfo=timezone.utc)
                > existing_set.modified_date
            ):
                if existing_set is None:
                    added_sets.append(response_set.tcgplayer_id)
                else:
                    updated_sets.append(response_set.tcgplayer_id)

                await task_queue.put(
                    update_set(
                        service=service,
                        tcgplayer_set=response_set,
                        catalog_id=catalog.id,
                        printing_tcgplayer_id_to_id_mapping=mappings.printing,
                        condition_tcgplayer_id_to_id_mapping=mappings.condition,
                        language_tcgplayer_id_to_id_mapping=mappings.language,
                    )
                )
            else:
                logger.debug(
                    f"Skipping set {response_set.tcgplayer_id} - {response_set.name} (no changes)"
                )

        await process_task_queue(task_queue)

    if added_sets or updated_sets:
        logger.info(
            f"Catalog {catalog.display_name}: Added {len(added_sets)} sets {added_sets}, "
            f"Updated {len(updated_sets)} sets {updated_sets}"
        )


async def update_card_database():
    """Update the entire card database by fetching all catalogs and their sets from TCGPlayer."""
    logger.info("Starting TCGPlayer catalog database update")
    try:
        async with tcgplayer_service_context() as service:
            with SessionLocal() as session, session.begin():
                catalog_response = await service.get_catalogs(list(SUPPORTED_CATALOGS))
                logger.info(f"Retrieved {len(catalog_response.results)} catalogs")

                catalog_values = [
                    {
                        "tcgplayer_id": catalog_detail_response.tcgplayer_id,
                        "modified_date": catalog_detail_response.modified_on,
                        "display_name": catalog_detail_response.display_name,
                    }
                    for catalog_detail_response in catalog_response.results
                ]

                session.execute(
                    upsert(
                        model=Catalog,
                        values=catalog_values,
                        index_elements=[Catalog.tcgplayer_id],
                    )
                )

            for catalog in session.scalars(select(Catalog)).all():
                logger.debug(f"Processing catalog: {catalog.display_name}")
                await update_catalog(service=service, catalog=catalog)

        logger.info("Completed TCGPlayer catalog database update")
    except Exception:
        logger.exception("Error updating card database")
        raise


if __name__ == "__main__":
    asyncio.run(update_card_database())
