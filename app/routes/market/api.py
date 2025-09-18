from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from typing import Dict, List
from datetime import timedelta
import uuid

from app.routes.catalog.schemas import (
    ProductWithSetAndSKUsResponseSchema,
    ProductSearchResponseSchema,
    SKUWithProductResponseSchema,
)
from app.routes.market.schemas import (
    CumulativeDepthLevelResponseSchema,
    MarketDataResponseSchema,
    SKUMarketDataItemResponseSchema,
    SKUMarketDataResponseSchema,
    SaleCumulativeDepthLevelResponseSchema,
    ProductListingsRequestParams,
    ProductListingResponseSchema,
    ProductListingsResponseSchema,
    ProductSalesRequestParams,
    ProductSaleResponseSchema,
    ProductSalesResponseSchema,
)
from app.routes.catalog.schemas import SKUBaseResponseSchema
from core.database import get_db_session
from core.models.catalog import Product, SKU
from core.models.catalog import Catalog
from core.models.catalog import Set
from core.models.price import Marketplace
from core.services.schemas.schema import ProductType
from core.services import market_data_service
from core.services.market_data_service import (
    MarketDataService,
    get_market_data_service,
    SkuNotFoundError,
)
from core.services.tcgplayer_listing_service import (
    CardListingRequestData,
    CardSaleRequestData,
    get_tcgplayer_listing_service,
    TCGPlayerListingService,
)
from core.services.sku_lookup import (
    build_sku_tcg_id_lookup_from_skus,
    build_sku_name_lookup_from_skus,
)

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
    market_data_service: MarketDataService = Depends(get_market_data_service),
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
    market_data_service: MarketDataService = Depends(get_market_data_service),
):
    """
    Return market data for a specific SKU variant.
    Now calls the dedicated service function.
    """
    try:
        service_data = await market_data_service.get_market_data_for_sku(
            session=session,
            sku_id=sku_id,
            sales_lookback_days=sales_lookback_days,
        )
    except SkuNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return _convert_service_data_to_response(service_data, session)


@router.get(
    "/product/{product_id}/listings",
    response_model=ProductListingsResponseSchema,
    summary="Get marketplace listings for a product",
)
async def get_product_listings(
    product_id: uuid.UUID,
    request_params: ProductListingsRequestParams = Depends(),
    session: Session = Depends(get_db_session),
    tcgplayer_listing_service: TCGPlayerListingService = Depends(
        get_tcgplayer_listing_service
    ),
):
    """
    Fetch active marketplace listings for a product.
    """
    # Verify product exists
    product = session.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")

    # Get product's TCGPlayer ID directly from model
    tcgplayer_product_id = product.tcgplayer_id
    if tcgplayer_product_id is None:
        return ProductListingsResponseSchema(results=[])

    # Fetch listings from TCGPlayer
    tcgplayer_request = CardListingRequestData(product_id=int(tcgplayer_product_id))
    tcgplayer_listings = await tcgplayer_listing_service.get_product_active_listings(
        tcgplayer_request
    )

    # Get product SKUs for matching (eager-load product for nested serialization)
    product_skus = session.scalars(
        select(SKU)
        .where(SKU.product_id == product_id)
        .options(*SKUWithProductResponseSchema.get_load_options())
    ).all()

    # Create SKU lookup by TCGPlayer SKU id (productConditionId)
    sku_by_tcg_id = build_sku_tcg_id_lookup_from_skus(product_skus)

    # Transform TCGPlayer listings to normalized format
    results = []
    for listing in tcgplayer_listings:
        # Find matching SKU by productConditionId
        sku = sku_by_tcg_id.get(listing.product_condition_id)

        if sku:  # Only include listings for SKUs we have in our database
            results.append(
                ProductListingResponseSchema(
                    listing_id=str(listing.listing_id),
                    sku=sku,
                    price=listing.price,
                    quantity=listing.quantity,
                    shipping_price=listing.shipping_price,
                    seller_name=listing.seller_name,
                )
            )

    return ProductListingsResponseSchema(results=results)


@router.get(
    "/product/{product_id}/sales",
    response_model=ProductSalesResponseSchema,
    summary="Get recent sales for a product",
)
async def get_product_sales(
    product_id: uuid.UUID,
    request_params: ProductSalesRequestParams = Depends(),
    session: Session = Depends(get_db_session),
    tcgplayer_listing_service: TCGPlayerListingService = Depends(
        get_tcgplayer_listing_service
    ),
):
    """
    Fetch recent sales for a product (up to 100 most recent).
    """
    # Verify product exists
    product = session.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")

    # Get product's TCGPlayer ID directly; if missing, return empty results
    tcgplayer_product_id = product.tcgplayer_id
    if tcgplayer_product_id is None:
        return ProductSalesResponseSchema(results=[])

    # Fetch sales from TCGPlayer (last 30 days, up to 100 results)
    tcgplayer_request = CardSaleRequestData(product_id=int(tcgplayer_product_id))
    tcgplayer_sales = await tcgplayer_listing_service.get_sales(
        tcgplayer_request, timedelta(days=30)
    )

    # Limit to 100 most recent
    tcgplayer_sales = tcgplayer_sales[:100]

    # Get product SKUs for matching (eager-load product for nested serialization)
    product_skus = session.scalars(
        select(SKU)
        .where(SKU.product_id == product_id)
        .options(*SKUWithProductResponseSchema.get_load_options())
    ).all()

    # Create SKU lookup by condition/printing/language
    sku_lookup = build_sku_name_lookup_from_skus(product_skus)

    results = []
    for sale in tcgplayer_sales:
        # Find matching SKU
        sku_key = (sale.condition, sale.variant, sale.language)
        sku = sku_lookup.get(sku_key)

        if sku:  # Only include sales for SKUs we have in our database
            results.append(
                ProductSaleResponseSchema(
                    sku=sku,
                    quantity=sale.quantity,
                    price=sale.purchase_price,
                    shipping_price=sale.shipping_price,
                    order_date=sale.order_date,
                )
            )

    return ProductSalesResponseSchema(results=results)
