from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session
from typing import Dict, List
import uuid

from app.routes.catalog.schemas import (
    ProductWithSetAndSKUsResponseSchema,
    ProductSearchResponseSchema,
)
from app.routes.market.schemas import (
    CumulativeDepthLevelResponseSchema,
    MarketDataResponseSchema,
    SKUMarketDataItemResponseSchema,
    SKUMarketDataResponseSchema,
    SaleCumulativeDepthLevelResponseSchema,
)
from app.routes.catalog.schemas import SKUBaseResponseSchema
from core.database import get_db_session
from core.models.catalog import Product, SKU
from core.models.catalog import Catalog
from core.models.catalog import Set
from core.models.price import Marketplace
from core.services.schemas.schema import ProductType
from core.services import market_data_service

router = APIRouter(
    prefix="/market",
)


def _convert_service_data_to_response(
    service_data: Dict[Marketplace, List[market_data_service.SKUMarketData]],
    session: Session,
) -> MarketDataResponseSchema:
    """
    Convert service layer marketplace-grouped data to API response schema.
    Handles batch SKU loading and DTO conversion.
    """
    # Collect all SKU IDs for batch query (avoid N+1)
    all_sku_ids = [
        sku_data.sku_id for sku_list in service_data.values() for sku_data in sku_list
    ]

    # Single batch query with proper eager loading
    skus = session.scalars(
        select(SKU)
        .options(*SKUBaseResponseSchema.get_load_options())
        .where(SKU.id.in_(all_sku_ids))
    ).all()

    # Create lookup map for O(1) access
    sku_map = {str(sku.id): sku for sku in skus}

    # Convert service DTOs to API schemas
    market_data_items = []
    for marketplace, sku_data_list in service_data.items():
        for sku_data in sku_data_list:
            # Get SKU from preloaded map
            sku = sku_map[sku_data.sku_id]
            # Convert cumulative depth levels
            cumulative_depth_levels = [
                CumulativeDepthLevelResponseSchema(
                    price=level.price,
                    cumulative_count=level.cumulative_count,
                )
                for level in sku_data.cumulative_depth_levels
            ]

            # Convert cumulative sales depth levels
            cumulative_sales_depth_levels = [
                SaleCumulativeDepthLevelResponseSchema(
                    price=level.price,
                    cumulative_count=level.cumulative_count,
                )
                for level in sku_data.cumulative_sales_depth_levels
            ]

            # Create market data schema
            market_data = SKUMarketDataResponseSchema(
                total_listings=sku_data.total_listings,
                total_quantity=sku_data.total_quantity,
                total_sales=sku_data.total_sales,
                sales_velocity=sku_data.sales_velocity,
                days_of_inventory=sku_data.days_of_inventory,
                cumulative_depth_levels=cumulative_depth_levels,
                cumulative_sales_depth_levels=cumulative_sales_depth_levels,
            )

            # Create SKU base schema from SKU model
            sku_base = SKUBaseResponseSchema.model_validate(sku)

            api_item = SKUMarketDataItemResponseSchema(
                marketplace=marketplace,
                sku=sku_base,
                market_data=market_data,
            )
            market_data_items.append(api_item)

    return MarketDataResponseSchema(market_data_items=market_data_items)


# @klin testing
@router.get("/products", response_model=ProductSearchResponseSchema)
def get_products_list(session: Session = Depends(get_db_session)):
    products = session.scalars(
        select(Product)
        .join(Set)
        .join(Catalog)
        .where(Product.product_type == ProductType.CARDS)
        .where(Catalog.display_name == "Pokemon")
        .limit(10)
        .options(*ProductWithSetAndSKUsResponseSchema.get_load_options())
    ).all()

    return ProductSearchResponseSchema(results=products)


@router.get(
    "/products/{product_id}",
    response_model=MarketDataResponseSchema,
    summary="Get market data for all Near Mint/Unopened SKUs of a Product",
)
async def get_product_data(
    product_id: uuid.UUID,
    sales_lookback_days: int = 30,
    session: Session = Depends(get_db_session),
):
    """
    Return market data for each **Near Mint or Unopened** SKU
    associated with the product.
    Includes aggregated metrics like total listings, total quantity,
    sales velocity, and estimated days of inventory.
    """
    # Call the refactored service function from the new service module
    service_data = await market_data_service.get_market_data_for_product(
        session=session,
        product_id=product_id,
        sales_lookback_days=sales_lookback_days,
    )

    return _convert_service_data_to_response(service_data, session)


@router.get(
    "/skus/{sku_id}",
    response_model=MarketDataResponseSchema,
    summary="Get market-depth data for a SKU variant",
)
async def get_sku_data(
    sku_id: uuid.UUID,
    sales_lookback_days: int = 30,
    session: Session = Depends(get_db_session),
):
    """
    Return market data for a specific SKU variant.
    Now calls the dedicated service function.
    """
    # Delegate to service which returns marketplace-grouped data
    service_data = await market_data_service.get_market_data_for_sku(
        session=session,
        sku_id=sku_id,
        sales_lookback_days=sales_lookback_days,
    )

    return _convert_service_data_to_response(service_data, session)
