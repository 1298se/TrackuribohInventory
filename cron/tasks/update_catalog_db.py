import asyncio
import logging
import uuid

from sqlalchemy import select

from core.database import upsert, SessionLocal
from core.models import Set, Product, SKU, Catalog, Printing, Condition, Language
from core.services.schemas.schema import CatalogSetSchema, ProductType
from core.services.tcgplayer_catalog_service import TCGPlayerCatalogService
from core.utils.workers import process_task_queue

logger = logging.getLogger(__name__)

PAGINATION_SIZE = 100

SUPPORTED_CATALOGS = frozenset(
    # YuGiOh, Pokemon
    [2, 3]
)


async def update_set(
    service: TCGPlayerCatalogService,
    tcgplayer_set: CatalogSetSchema,
    catalog_id: uuid.UUID,
    printing_tcgplayer_id_to_id_mapping: dict[int, int],
    condition_tcgplayer_id_to_id_mapping: dict[int, int],
    language_tcgplayer_id_to_id_mapping: dict[int, int],
):
    with SessionLocal() as session, session.begin():
        current_offset = 0
        total = None

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
                index_elements=[Set.tcgplayer_id]
            ).returning(Set.id)
        ).one()

        print(f"updating set id: {current_set_id}")

        for product_type in ProductType:
            while total is None or current_offset < total:
                sets_response = await service.get_products(
                    tcgplayer_set_id=tcgplayer_set.tcgplayer_id,
                    offset=current_offset,
                    limit=PAGINATION_SIZE,
                    product_type=product_type,
                )

                if "No products were found." in sets_response.errors:
                    return

                current_offset += len(sets_response.results)
                total = sets_response.total_items if sets_response.total_items is not None else 0

                product_values = [
                    {
                        "tcgplayer_id": product.tcgplayer_id,
                        "name": product.name,
                        "clean_name": product.clean_name,
                        "image_url": product.image_url,
                        "set_id": current_set_id,
                        "product_type": product_type,
                        "data": product.extended_data,
                    }
                    for product in sets_response.results
                ]

                result = session.execute(
                    upsert(
                        model=Product,
                        values=product_values,
                        index_elements=[Product.tcgplayer_id],
                    ).returning(Product.tcgplayer_id, Product.id)
                )

                product_tcgplayer_id_to_id_mapping = {
                    row.tcgplayer_id: row.id
                    for row in result.all()
                }

                sku_values = [
                    {
                        "tcgplayer_id": sku.tcgplayer_id,
                        "product_id": product_tcgplayer_id_to_id_mapping[sku.tcgplayer_product_id],
                        "printing_id": printing_tcgplayer_id_to_id_mapping[sku.tcgplayer_printing_id],
                        "condition_id": condition_tcgplayer_id_to_id_mapping[sku.tcgplayer_condition_id],
                        "language_id": language_tcgplayer_id_to_id_mapping[sku.tcgplayer_language_id],
                    }
                    for product in sets_response.results for sku in product.skus
                ]

                session.execute(
                    upsert(
                        model=SKU,
                        values=sku_values,
                        index_elements=[SKU.tcgplayer_id],
                    )
                )

async def update_catalog(service: TCGPlayerCatalogService, catalog: Catalog):
    # Each coroutine should have its own connection to db
    with SessionLocal() as session:
        printings_request = service.get_printings(catalog_id=catalog.tcgplayer_id)
        conditions_request = service.get_conditions(catalog_id=catalog.tcgplayer_id)
        languages_request = service.get_languages(catalog_id=catalog.tcgplayer_id)

        printing_values = [
            {
                "tcgplayer_id": printing_detail_response.tcgplayer_id,
                "name": printing_detail_response.name,
                "catalog_id": catalog.id,
            }
            for printing_detail_response in (await printings_request).results
        ]

        result = session.execute(
            upsert(model=Printing, values=printing_values, index_elements=[Printing.tcgplayer_id])
            .returning(Printing.tcgplayer_id, Printing.id)
        ).all()

        printing_tcgplayer_id_to_id_mapping = {
            row.tcgplayer_id: row.id
            for row in result
        }

        condition_values = [
            {
                "tcgplayer_id": condition_detail_response.tcgplayer_id,
                "catalog_id": catalog.id,
                "name": condition_detail_response.name,
                "abbreviation": condition_detail_response.abbreviation
            }
            for condition_detail_response in (await conditions_request).results
        ]

        result = session.execute(
            upsert(model=Condition, values=condition_values, index_elements=[Condition.tcgplayer_id])
            .returning(Condition.tcgplayer_id, Condition.id)
        ).all()

        condition_tcgplayer_id_to_id_mapping = {
            row.tcgplayer_id: row.id
            for row in result
        }

        languages_values = [
            {
                "tcgplayer_id": language_detail_response.tcgplayer_id,
                "catalog_id": catalog.id,
                "name": language_detail_response.name,
                "abbreviation": language_detail_response.abbr
            }
            for language_detail_response in (await languages_request).results
        ]

        result = session.execute(
            upsert(model=Language, values=languages_values, index_elements=[Language.tcgplayer_id])
            .returning(Language.tcgplayer_id, Language.id)
        ).all()

        language_tcgplayer_id_to_id_mapping = {
            row.tcgplayer_id: row.id
            for row in result
        }

    task_queue = asyncio.Queue()

    current_offset = 0
    total = None

    while total is None or current_offset < total:
        sets_response = await service.get_sets(
            catalog_id=catalog.tcgplayer_id,
            offset=current_offset,
            limit=PAGINATION_SIZE
        )

        sets_response_ids = [response.tcgplayer_id for response in sets_response.results]

        sets = session.scalars(select(Set).where(Set.tcgplayer_id.in_(sets_response_ids))).all()

        set_tcgplayer_id_to_set = {
            set.tcgplayer_id: set
            for set in sets
        }

        total = sets_response.total_items if sets_response.total_items is not None else 0
        current_offset += len(sets_response.results)

        for response_set in sets_response.results:
            set = set_tcgplayer_id_to_set.get(response_set.tcgplayer_id)

            if set is None or set.modified_date != response_set.modified_on:
                await task_queue.put(update_set(
                    service=service,
                    tcgplayer_set=response_set,
                    catalog_id=catalog.id,
                    printing_tcgplayer_id_to_id_mapping=printing_tcgplayer_id_to_id_mapping,
                    condition_tcgplayer_id_to_id_mapping=condition_tcgplayer_id_to_id_mapping,
                    language_tcgplayer_id_to_id_mapping=language_tcgplayer_id_to_id_mapping,
                ))
            else:
                print(f"skipping set: {set.id}")

        # We do this because we have a maximum number of simultaneous connections we can make to the database.
        # The number 20 was picked arbitrarily, but works quite well.
        await process_task_queue(task_queue, num_workers=20)


async def update_card_database():
    async with TCGPlayerCatalogService() as service:
        with SessionLocal() as session:
            catalog_response = await service.get_catalogs(list(SUPPORTED_CATALOGS))

            catalog_values = [
                {
                    "tcgplayer_id": catalog_detail_response.tcgplayer_id,
                    "modified_date": catalog_detail_response.modified_on,
                    "display_name": catalog_detail_response.display_name,
                }
                for catalog_detail_response in catalog_response.results
            ]

            session.execute(upsert(model=Catalog, values=catalog_values, index_elements=[Catalog.tcgplayer_id]))

        for catalog in session.scalars(select(Catalog)).all():
            await update_catalog(service=service, catalog=catalog)

if __name__ == '__main__':
    asyncio.run(
        update_card_database(),
    )
