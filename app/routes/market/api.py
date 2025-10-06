from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from typing import Dict, List
from datetime import timedelta
import uuid

from app.routes.catalog.schemas import (
    ProductWithSetAndSKUsResponseSchema,
    ProductSearchResponseSchema,
    SKUWithProductResponseSchema,
    TopPricedCardSchema,
    HistoricalPriceComparisonSchema,
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
    SKUMarketPriceSchema,
    ProductMarketPricesResponseSchema,
)
from app.routes.catalog.schemas import SKUBaseResponseSchema
from core.database import get_db_session
from core.models.catalog import Product, SKU
from core.models.catalog import Catalog
from core.models.catalog import Set
from core.models.price import Marketplace, SKULatestPrice
from core.models.catalog import Condition, Printing, Language
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
                    seller_id=listing.seller_id,
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

@router.get(
    "/set/{set_id}/price-comparison",
    response_model=HistoricalPriceComparisonSchema,
    summary="Get current and historical market value comparison for a set",
)
def get_set_price_comparison(
    set_id: uuid.UUID,
    days_ago: int = 30,
    session: Session = Depends(get_db_session),
):
    """
    Calculate the total market value of all cards in a set, comparing current prices
    with historical prices from N days ago to show growth trends.
    """
    from datetime import datetime, timedelta
    from core.models.price import SKUPriceDataSnapshot
    
    # Verify set exists
    set_obj = session.get(Set, set_id)
    if set_obj is None:
        raise HTTPException(status_code=404, detail="Set not found")
    
    # Calculate historical date
    historical_date = datetime.now() - timedelta(days=days_ago)
    
    # Get current prices (latest)
    current_result = session.execute(
        select(SKU, SKULatestPrice.lowest_listing_price_total, Product.name, Condition.name, Printing.name, Language.name)
        .select_from(SKU)
        .join(Product, SKU.product_id == Product.id)
        .join(Set, Product.set_id == Set.id)
        .join(Condition, SKU.condition_id == Condition.id)
        .join(Printing, SKU.printing_id == Printing.id)
        .join(Language, SKU.language_id == Language.id)
        .outerjoin(
            SKULatestPrice,
            (SKULatestPrice.sku_id == SKU.id)
            & (SKULatestPrice.marketplace == Marketplace.TCGPLAYER),
        )
        .where(Set.id == set_id)
        .where(Product.product_type == ProductType.CARDS)
    ).all()
    
    # Get historical prices from the closest snapshot to historical_date
    # We need to get the latest snapshot for each SKU that was taken on or before historical_date
    historical_subquery = (
        select(
            SKUPriceDataSnapshot.sku_id,
            func.max(SKUPriceDataSnapshot.snapshot_datetime).label('latest_snapshot_date')
        )
        .where(
            (SKUPriceDataSnapshot.marketplace == Marketplace.TCGPLAYER)
            & (SKUPriceDataSnapshot.snapshot_datetime <= historical_date)
        )
        .group_by(SKUPriceDataSnapshot.sku_id)
        .subquery()
    )
    
    historical_result = session.execute(
        select(SKU, SKUPriceDataSnapshot.lowest_listing_price_total, Product.name, Condition.name, Printing.name, Language.name)
        .select_from(SKU)
        .join(Product, SKU.product_id == Product.id)
        .join(Set, Product.set_id == Set.id)
        .join(Condition, SKU.condition_id == Condition.id)
        .join(Printing, SKU.printing_id == Printing.id)
        .join(Language, SKU.language_id == Language.id)
        .join(
            historical_subquery,
            historical_subquery.c.sku_id == SKU.id
        )
        .join(
            SKUPriceDataSnapshot,
            (SKUPriceDataSnapshot.sku_id == SKU.id)
            & (SKUPriceDataSnapshot.marketplace == Marketplace.TCGPLAYER)
            & (SKUPriceDataSnapshot.snapshot_datetime == historical_subquery.c.latest_snapshot_date)
        )
        .where(Set.id == set_id)
        .where(Product.product_type == ProductType.CARDS)
    ).all()
    
    # Calculate current totals
    current_total_market_value = 0.0
    current_top_priced_card = None
    current_highest_price = 0.0
    
    for sku, price, product_name, condition_name, printing_name, language_name in current_result:
        if price is not None:
            price_float = float(price)
            current_total_market_value += price_float
            
            # Only consider Near Mint cards for top priced card
            if price_float > current_highest_price and condition_name == "Near Mint":
                current_highest_price = price_float
                current_top_priced_card = TopPricedCardSchema(
                    sku_id=sku.id,
                    product_name=product_name,
                    condition=condition_name,
                    printing=printing_name,
                    language=language_name,
                    price=price_float,
                )
    
    # Calculate historical totals
    historical_total_market_value = 0.0
    historical_top_priced_card = None
    historical_highest_price = 0.0
    
    for sku, price, product_name, condition_name, printing_name, language_name in historical_result:
        if price is not None:
            price_float = float(price)
            historical_total_market_value += price_float
            
            # Only consider Near Mint cards for top priced card
            if price_float > historical_highest_price and condition_name == "Near Mint":
                historical_highest_price = price_float
                historical_top_priced_card = TopPricedCardSchema(
                    sku_id=sku.id,
                    product_name=product_name,
                    condition=condition_name,
                    printing=printing_name,
                    language=language_name,
                    price=price_float,
                )
    
    # Calculate growth percentages
    growth_percentage = None
    if historical_total_market_value > 0:
        growth_percentage = round(
            ((current_total_market_value - historical_total_market_value) / historical_total_market_value) * 100, 2
        )
    
    # Calculate top card growth percentage
    # Since we're always comparing Near Mint cards, we can directly compare if they're the same SKU
    top_card_growth_percentage = None
    if current_top_priced_card and historical_top_priced_card:
        if historical_top_priced_card.sku_id == current_top_priced_card.sku_id:
            if historical_top_priced_card.price > 0:
                top_card_growth_percentage = round(
                    ((current_top_priced_card.price - historical_top_priced_card.price) / historical_top_priced_card.price) * 100, 2
                )
    
    return HistoricalPriceComparisonSchema(
        current_total_market_value=round(current_total_market_value, 2),
        historical_total_market_value=round(historical_total_market_value, 2) if historical_total_market_value > 0 else None,
        growth_percentage=growth_percentage,
        current_top_priced_card=current_top_priced_card,
        historical_top_priced_card=historical_top_priced_card,
        top_card_growth_percentage=top_card_growth_percentage,
    )


@router.get(
    "/product/{product_id}/market-prices",
    response_model=ProductMarketPricesResponseSchema,
    summary="Get market prices for all SKUs of a product",
)
def get_product_market_prices(
    product_id: uuid.UUID,
    session: Session = Depends(get_db_session),
):
    """
    Fetch the lowest listing price for each SKU of a product.
    """
    # Query to get SKU IDs and their prices
    result = session.execute(
        select(SKU.id, SKULatestPrice.lowest_listing_price_total)
        .select_from(SKU)
        .outerjoin(
            SKULatestPrice,
            (SKULatestPrice.sku_id == SKU.id)
            & (SKULatestPrice.marketplace == Marketplace.TCGPLAYER),
        )
        .where(SKU.product_id == product_id)
    ).all()

    # Build response
    prices = [
        SKUMarketPriceSchema(
            sku_id=str(sku_id),
            lowest_listing_price_total=float(price) if price is not None else None,
        )
        for sku_id, price in result
    ]

    return ProductMarketPricesResponseSchema(prices=prices)
