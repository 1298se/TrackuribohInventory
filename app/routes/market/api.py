from datetime import datetime, timedelta
from datetime import timezone as datetime_timezone
from typing import Dict, List
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.routes.catalog.schemas import (
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
    MarketplacePriceSchema,
    ProductVariantPriceSummaryResponseSchema,
    ProductVariantPriceHistoryResponseSchema,
    SKUPriceHistorySeriesSchema,
    PriceHistoryItemSchema,
)
from app.routes.catalog.schemas import SKUBaseResponseSchema
from app.routes.utils import MoneySchema
from core.database import get_db_session
from core.models.catalog import Product, ProductVariant, SKU
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
    CardSaleRequestData,
    get_tcgplayer_listing_service,
    TCGPlayerListingService,
)
from core.services.tcgplayer_catalog_service import (
    TCGPlayerCatalogService,
    get_tcgplayer_catalog_service,
)
from core.services.ebay_listing_service import (
    EbayListingService,
    get_ebay_listing_service,
)
from core.services.sku_lookup import build_sku_name_lookup_from_skus
from app.routes.market.service import (
    get_tcgplayer_product_variant_listings,
    get_ebay_product_variant_listings,
)
from core.dao.price import (
    fetch_bulk_sku_price_histories,
    date_to_datetime_utc,
    PriceHistoryPoint,
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
    "/product-variants/{product_variant_id}/market-data",
    response_model=MarketDataResponseSchema,
    summary="Get market data for Near Mint/Unopened SKUs of a product variant",
)
async def get_product_variant_market_data(
    product_variant_id: uuid.UUID,
    sales_lookback_days: int = 30,
    session: Session = Depends(get_db_session),
    market_data_service: MarketDataService = Depends(get_market_data_service),
):
    """
    Return cumulative depth data, summary stats, and historical sales for all Near Mint / Unopened SKUs
    for a specific product variant (specific printing like "Holofoil").

    This endpoint provides market depth charts, listing/sales velocity, and inventory metrics
    scoped to a single variant rather than the entire product.
    """
    service_data = await market_data_service.get_market_data_for_product_variant(
        session=session,
        product_variant_id=product_variant_id,
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
    "/product-variants/{product_variant_id}/listings",
    response_model=ProductListingsResponseSchema,
    summary="Get marketplace listings for a product variant",
)
async def get_product_variant_listings(
    product_variant_id: uuid.UUID,
    request_params: ProductListingsRequestParams = Depends(),
    session: Session = Depends(get_db_session),
    tcgplayer_listing_service: TCGPlayerListingService = Depends(
        get_tcgplayer_listing_service
    ),
    ebay_listing_service: EbayListingService = Depends(get_ebay_listing_service),
):
    """
    Fetch active marketplace listings for a specific product variant.
    """
    product_variant = session.get(ProductVariant, product_variant_id)
    if product_variant is None:
        raise HTTPException(status_code=404, detail="Product variant not found")

    requested_marketplaces = (
        list(dict.fromkeys(request_params.marketplace))
        if request_params.marketplace
        else list(Marketplace)
    )

    combined_results: List[ProductListingResponseSchema] = []

    if Marketplace.TCGPLAYER in requested_marketplaces:
        combined_results.extend(
            await get_tcgplayer_product_variant_listings(
                product_variant_id=product_variant_id,
                session=session,
                tcgplayer_listing_service=tcgplayer_listing_service,
            )
        )

    if Marketplace.EBAY in requested_marketplaces:
        combined_results.extend(
            await get_ebay_product_variant_listings(
                product_variant_id=product_variant_id,
                session=session,
                ebay_listing_service=ebay_listing_service,
            )
        )

    combined_results.sort(
        key=lambda listing: listing.price + (listing.shipping_price or 0)
    )

    return ProductListingsResponseSchema(results=combined_results)


@router.get(
    "/product-variants/{product_variant_id}/sales",
    response_model=ProductSalesResponseSchema,
    summary="Get recent sales for a product variant",
)
async def get_product_variant_sales(
    product_variant_id: uuid.UUID,
    request_params: ProductSalesRequestParams = Depends(),
    session: Session = Depends(get_db_session),
    tcgplayer_listing_service: TCGPlayerListingService = Depends(
        get_tcgplayer_listing_service
    ),
):
    """
    Fetch recent sales for a product variant (up to 100 most recent).
    """
    # Verify product variant exists
    product_variant = session.get(ProductVariant, product_variant_id)
    if product_variant is None:
        raise HTTPException(status_code=404, detail="Product variant not found")

    # Get product's TCGPlayer ID; if missing, return empty results
    if product_variant.product.tcgplayer_id is None:
        return ProductSalesResponseSchema(results=[])

    tcgplayer_product_id = product_variant.product.tcgplayer_id

    # Get printing TCGPlayer ID for filtering
    printing_tcgplayer_id = product_variant.printing.tcgplayer_id

    # Fetch sales from TCGPlayer (last 30 days, up to 100 results)
    # Filter by printing to get sales only for this specific variant
    tcgplayer_request = CardSaleRequestData(
        product_id=int(tcgplayer_product_id), printings=[int(printing_tcgplayer_id)]
    )
    tcgplayer_sales = await tcgplayer_listing_service.get_sales(
        tcgplayer_request, timedelta(days=30)
    )

    # Limit to 100 most recent
    tcgplayer_sales = tcgplayer_sales[:100]

    # Get variant SKUs for matching (eager-load product for nested serialization)
    variant_skus = session.scalars(
        select(SKU)
        .where(SKU.variant_id == product_variant_id)
        .options(*SKUWithProductResponseSchema.get_load_options())
    ).all()

    # Create SKU lookup by condition/printing/language
    sku_lookup = build_sku_name_lookup_from_skus(variant_skus)

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
                    price=MoneySchema(amount=sale.purchase_price, currency="USD"),
                    shipping_price=MoneySchema(
                        amount=sale.shipping_price, currency="USD"
                    )
                    if sale.shipping_price
                    else None,
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
        select(
            SKU,
            SKULatestPrice.lowest_listing_price_total,
            Product.name,
            Condition.name,
            Printing.name,
            Language.name,
        )
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
            func.max(SKUPriceDataSnapshot.snapshot_datetime).label(
                "latest_snapshot_date"
            ),
        )
        .where(
            (SKUPriceDataSnapshot.marketplace == Marketplace.TCGPLAYER)
            & (SKUPriceDataSnapshot.snapshot_datetime <= historical_date)
        )
        .group_by(SKUPriceDataSnapshot.sku_id)
        .subquery()
    )

    historical_result = session.execute(
        select(
            SKU,
            SKUPriceDataSnapshot.lowest_listing_price_total,
            Product.name,
            Condition.name,
            Printing.name,
            Language.name,
        )
        .select_from(SKU)
        .join(Product, SKU.product_id == Product.id)
        .join(Set, Product.set_id == Set.id)
        .join(Condition, SKU.condition_id == Condition.id)
        .join(Printing, SKU.printing_id == Printing.id)
        .join(Language, SKU.language_id == Language.id)
        .join(historical_subquery, historical_subquery.c.sku_id == SKU.id)
        .join(
            SKUPriceDataSnapshot,
            (SKUPriceDataSnapshot.sku_id == SKU.id)
            & (SKUPriceDataSnapshot.marketplace == Marketplace.TCGPLAYER)
            & (
                SKUPriceDataSnapshot.snapshot_datetime
                == historical_subquery.c.latest_snapshot_date
            ),
        )
        .where(Set.id == set_id)
        .where(Product.product_type == ProductType.CARDS)
    ).all()

    # Calculate current totals
    current_total_market_value = 0.0
    current_top_priced_card = None
    current_highest_price = 0.0

    for (
        sku,
        price,
        product_name,
        condition_name,
        printing_name,
        language_name,
    ) in current_result:
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

    for (
        sku,
        price,
        product_name,
        condition_name,
        printing_name,
        language_name,
    ) in historical_result:
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
            (
                (current_total_market_value - historical_total_market_value)
                / historical_total_market_value
            )
            * 100,
            2,
        )

    # Calculate top card growth percentage
    # Since we're always comparing Near Mint cards, we can directly compare if they're the same SKU
    top_card_growth_percentage = None
    if current_top_priced_card and historical_top_priced_card:
        if historical_top_priced_card.sku_id == current_top_priced_card.sku_id:
            if historical_top_priced_card.price > 0:
                top_card_growth_percentage = round(
                    (
                        (
                            current_top_priced_card.price
                            - historical_top_priced_card.price
                        )
                        / historical_top_priced_card.price
                    )
                    * 100,
                    2,
                )

    return HistoricalPriceComparisonSchema(
        current_total_market_value=round(current_total_market_value, 2),
        historical_total_market_value=round(historical_total_market_value, 2)
        if historical_total_market_value > 0
        else None,
        growth_percentage=growth_percentage,
        current_top_priced_card=current_top_priced_card,
        historical_top_priced_card=historical_top_priced_card,
        top_card_growth_percentage=top_card_growth_percentage,
    )


@router.get(
    "/product-variant/{product_variant_id}/price-summary",
    response_model=ProductVariantPriceSummaryResponseSchema,
    summary="Get Near Mint market prices for a product variant across all marketplaces",
)
async def get_product_variant_price_summary(
    product_variant_id: uuid.UUID,
    session: Session = Depends(get_db_session),
    tcgplayer_catalog_service: TCGPlayerCatalogService = Depends(
        get_tcgplayer_catalog_service
    ),
):
    """
    Fetch the Near Mint price for a product variant from all available marketplaces.

    Uses TCGPlayer's market price API for TCGPlayer pricing (more accurate than lowest listing).
    Uses cached prices from SKULatestPrice for eBay.

    Args:
        product_variant_id: The UUID of the product variant

    Returns:
        ProductVariantPriceSummaryResponseSchema with prices per marketplace
    """
    # Step 1: Query the variant with product and printing relationships
    from sqlalchemy.orm import joinedload

    variant = session.scalars(
        select(ProductVariant)
        .where(ProductVariant.id == product_variant_id)
        .options(
            joinedload(ProductVariant.product), joinedload(ProductVariant.printing)
        )
    ).first()

    if not variant:
        return ProductVariantPriceSummaryResponseSchema(prices=[])

    prices: List[MarketplacePriceSchema] = []

    # Step 2: Fetch TCGPlayer market price from their API
    if variant.product.tcgplayer_id:
        try:
            market_price_response = (
                await tcgplayer_catalog_service.get_product_market_prices(
                    variant.product.tcgplayer_id
                )
            )

            if market_price_response.success:
                # Find the matching variant by subTypeName
                printing_name = variant.printing.name if variant.printing else None
                if printing_name:
                    for result in market_price_response.results:
                        if result.sub_type_name == printing_name:
                            prices.append(
                                MarketplacePriceSchema(
                                    marketplace=Marketplace.TCGPLAYER,
                                    market_price=result.market_price,
                                )
                            )
                            break
        except Exception as e:
            # Log error but continue to fetch eBay price
            import logging

            logging.warning(
                f"Failed to fetch TCGPlayer market price for variant {product_variant_id}: {e}"
            )

    # Step 3: Fetch eBay price from SKULatestPrice (fallback to cached data)
    near_mint_sku_id = session.scalars(
        select(SKU.id)
        .join(Condition)
        .where(SKU.variant_id == product_variant_id)
        .where(Condition.abbreviation == "NM")
    ).first()

    if near_mint_sku_id:
        ebay_price = session.scalars(
            select(SKULatestPrice.lowest_listing_price_total).where(
                SKULatestPrice.sku_id == near_mint_sku_id,
                SKULatestPrice.marketplace == Marketplace.EBAY,
            )
        ).first()

        if ebay_price is not None:
            prices.append(
                MarketplacePriceSchema(
                    marketplace=Marketplace.EBAY,
                    market_price=float(ebay_price),
                )
            )

    return ProductVariantPriceSummaryResponseSchema(prices=prices)


@router.get(
    "/product-variants/{product_variant_id}/price-history",
    response_model=ProductVariantPriceHistoryResponseSchema,
    summary="Get price history for all SKUs in a product variant",
)
async def get_product_variant_price_history(
    product_variant_id: uuid.UUID,
    days: int | None = None,
    _marketplace: str | None = None,
    session: Session = Depends(get_db_session),
    tcgplayer_catalog_service: TCGPlayerCatalogService = Depends(
        get_tcgplayer_catalog_service
    ),
):
    """
    Return normalized daily price history for every SKU in the given product variant.

    Pulls historical data from the price history table and forward-fills the most recent
    marketplace data by calling TCGPlayer directly for today's price when available.

    Parameters:
    - days: Number of days to look back. If None, returns all historical data.
    """
    if days is not None:
        start_date = datetime.now(datetime_timezone.utc) - timedelta(days=days)
    else:
        # Return all historical data - use a very old date as start
        start_date = datetime(2000, 1, 1, tzinfo=datetime_timezone.utc)

    end_date = datetime.now(datetime_timezone.utc)

    sku_records = session.scalars(
        select(SKU)
        .join(Condition, SKU.condition_id == Condition.id)
        .where(SKU.variant_id == product_variant_id)
        .order_by(Condition.tcgplayer_id)
        .options(*SKUBaseResponseSchema.get_load_options())
    ).all()

    if not sku_records:
        return ProductVariantPriceHistoryResponseSchema(series=[])

    sku_ids = [sku.id for sku in sku_records]

    price_histories = fetch_bulk_sku_price_histories(
        session=session,
        sku_ids=sku_ids,
        start_date=start_date,
        end_date=end_date,
    )

    try:
        sku_tcgplayer_ids = [
            sku.tcgplayer_id for sku in sku_records if sku.tcgplayer_id
        ]

        if sku_tcgplayer_ids:
            sku_prices_response = await tcgplayer_catalog_service.get_sku_prices(
                sku_tcgplayer_ids
            )

            if sku_prices_response.results:
                today_iso = date_to_datetime_utc(
                    datetime.now(datetime_timezone.utc).date()
                ).isoformat()
                tcgplayer_to_sku = {sku.tcgplayer_id: sku.id for sku in sku_records}

                for price_result in sku_prices_response.results:
                    sku_id = tcgplayer_to_sku.get(price_result.sku_id)
                    if sku_id and price_result.lowest_listing_price_total is not None:
                        price_data = price_histories.get(sku_id)

                        # Only enrich SKUs that already have historical data
                        if not price_data:
                            continue

                        fresh_price = float(price_result.lowest_listing_price_total)

                        if price_data and price_data[-1].datetime_iso == today_iso:
                            price_data[-1].price = fresh_price
                        else:
                            price_data.append(
                                PriceHistoryPoint(
                                    datetime_iso=today_iso, price=fresh_price
                                )
                            )

    except Exception as exc:  # noqa: BLE001
        import logging

        logging.warning(
            "Failed to fetch fresh price data for product variant %s: %s",
            product_variant_id,
            exc,
        )

    series: list[SKUPriceHistorySeriesSchema] = []
    for sku in sku_records:
        price_data = price_histories.get(sku.id, [])
        if not price_data:
            continue
        history_items = [
            PriceHistoryItemSchema(
                datetime=datetime.fromisoformat(point.datetime_iso),
                price=MoneySchema(
                    amount=point.price,
                    currency="USD",
                ),
            )
            for point in price_data
        ]

        series.append(
            SKUPriceHistorySeriesSchema(
                sku=SKUBaseResponseSchema.model_validate(sku),
                items=history_items,
            )
        )

    return ProductVariantPriceHistoryResponseSchema(series=series)
