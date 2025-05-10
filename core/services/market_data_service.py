import uuid
from collections import defaultdict
from typing import List, Dict, Any, TypedDict, Optional
from datetime import timedelta

from fastapi import HTTPException  # Import HTTPException for error handling
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select

from core.models.catalog import SKU  # Import necessary models
from core.services.tcgplayer_listing_service import (
    CardSaleResponse,
    get_product_active_listings,
    get_sales,
    CardListingRequestData,
    CardSaleRequestData,
    SKUListingResponse,
)

# Import necessary schemas from app routes (consider moving to core.schemas later if needed)
from app.routes.catalog.schemas import (
    SKUMarketDataResponseSchema,
    SKUMarketDataItemResponseSchema,
    CumulativeDepthLevelResponseSchema,
)


# Define TypedDict for the return value of get_market_data_for_product
class ProductMarketDataResult(TypedDict):
    """Results returned from get_market_data_for_product containing only items."""

    market_data_items: List[SKUMarketDataItemResponseSchema]


def calculate_cumulative_depth_levels(
    listing_events: List[SKUListingResponse],
) -> List[CumulativeDepthLevelResponseSchema]:
    """
    Helper function to calculate cumulative depth levels from a list of listing events.
    """
    depth_map: Dict[float, int] = defaultdict(int)
    for listing in listing_events:
        # Access as attributes on Pydantic model
        price = float(listing.price)
        shipping_price = float(getattr(listing, "shippingPrice", 0.0) or 0.0)
        quantity = int(getattr(listing, "quantity", 0) or 0)

        if quantity > 0:
            total_price = round(price + shipping_price, 2)
            depth_map[total_price] += quantity

    # Calculate cumulative depth levels
    cumulative_depth_levels = []
    current_cumulative_count = 0
    for price in sorted(depth_map.keys()):
        current_cumulative_count += depth_map[price]
        cumulative_depth_levels.append(
            CumulativeDepthLevelResponseSchema(
                price=price, cumulative_count=current_cumulative_count
            )
        )

    return cumulative_depth_levels


# Shared helper to compute aggregate metrics for market data endpoints
def _compute_aggregated_metrics(
    listings: List[SKUListingResponse],
    sales_records: List[CardSaleResponse],
    days: int = 7,
) -> tuple[int, int, float, Optional[float]]:
    """
    Compute total listings, total quantity, average daily sales velocity, and days of inventory.
    """
    total_quantity = sum(listing.quantity for listing in listings)
    total_listings = len(listings)
    sales_count = len(sales_records)
    sales_velocity_daily_avg = sales_count / days if days > 0 else 0.0
    days_of_inventory: Optional[float] = None
    if sales_velocity_daily_avg > 0 and total_quantity > 0:
        days_of_inventory = round(total_quantity / sales_velocity_daily_avg, 1)
    return (
        total_listings,
        total_quantity,
        round(sales_velocity_daily_avg, 2),
        days_of_inventory,
    )


def _build_sku_item(
    sku: SKU,
    listings: List[SKUListingResponse],
    sales_records: List[CardSaleResponse],
    marketplace: str = "TCGPlayer",
) -> SKUMarketDataItemResponseSchema:
    """Helper to build a SKUMarketDataItemResponseSchema for one SKU & marketplace."""
    depth_levels = calculate_cumulative_depth_levels(listings)
    total_listings, total_quantity, sales_velocity, days_of_inventory = (
        _compute_aggregated_metrics(listings, sales_records)
    )
    market_data = SKUMarketDataResponseSchema(
        total_listings=total_listings,
        total_quantity=total_quantity,
        sales_velocity=sales_velocity,
        days_of_inventory=days_of_inventory,
        cumulative_depth_levels=depth_levels,
    )
    return SKUMarketDataItemResponseSchema(
        marketplace=marketplace,
        sku=sku,
        market_data=market_data,
    )


async def get_market_data_for_sku(
    session: Session, sku_id: uuid.UUID
) -> ProductMarketDataResult:
    """
    Fetches market data (cumulative depth + summary) for a specific SKU ID.
    Raises HTTPException if SKU not found.
    """
    # 1. Load SKU with required relations for request_data
    sku = session.execute(
        select(SKU)
        .options(
            joinedload(SKU.product, innerjoin=True),
            joinedload(SKU.printing, innerjoin=True),
            joinedload(SKU.condition, innerjoin=True),
            joinedload(SKU.language, innerjoin=True),
        )
        .where(SKU.id == sku_id)
    ).scalar_one_or_none()

    if not sku:
        raise HTTPException(status_code=404, detail=f"SKU not found: {sku_id}")

    if not all([sku.product, sku.printing, sku.condition]):
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load required SKU relations for {sku_id}",
        )

    # 2. Prepare listing and sales request data for the SKU
    listing_request_data = CardListingRequestData(
        product_id=sku.product.tcgplayer_id,
        printings=[sku.printing.name],
        conditions=[sku.condition.name],
        languages=[sku.language.name],
    )
    sales_request_data = CardSaleRequestData(
        product_id=sku.product.tcgplayer_id,
        printings=[sku.printing.tcgplayer_id],
        conditions=[sku.condition.tcgplayer_id],
        languages=[sku.language.tcgplayer_id],
    )

    # 3. Fetch listings and sales, then compute depth and metrics
    listings: List[SKUListingResponse] = []
    sales_records: List[Any] = []
    try:
        listings = await get_product_active_listings(listing_request_data)
    except Exception as e:
        print(f"Error fetching TCGPlayer listings for SKU {sku_id}: {e}")
    try:
        sales_records = await get_sales(sales_request_data, timedelta(days=7))
    except Exception as e:
        print(f"Error fetching TCGPlayer sales for SKU {sku_id}: {e}")

    # Build a single-item market data response
    item = _build_sku_item(sku, listings, sales_records)
    return {"market_data_items": [item]}


async def get_market_data_for_product(
    session: Session, product_id: uuid.UUID
) -> ProductMarketDataResult:
    """
    Fetches market data for each SKU of a product, structured per marketplace.
    Makes a single API call for all SKUs to improve performance.
    Returns a dictionary with market_data_items and aggregated metrics.
    """
    # 1. Load Product and related SKU objects
    skus = session.scalars(
        select(SKU)
        .options(
            joinedload(SKU.printing),
            joinedload(SKU.language),
            joinedload(SKU.condition),
            joinedload(SKU.product),
        )
        .where(SKU.product_id == product_id)
        .order_by(SKU.id)
    ).all()

    if not skus:
        print(f"No SKUs found for product: {product_id}")
        return {"market_data_items": []}

    # 2. Prepare for API request

    results = []
    all_listings = []

    tcgplayer_id = skus[0].product.tcgplayer_id

    try:
        listing_request_data = CardListingRequestData(
            product_id=tcgplayer_id,
            printings=[sku.printing.name for sku in skus if sku.printing],
            conditions=[sku.condition.name for sku in skus if sku.condition],
            languages=[sku.language.name for sku in skus if sku.language],
        )
        # 3. Make single API call for all SKUs
        all_listings = await get_product_active_listings(listing_request_data)

        # 4. Process data for each SKU
        for sku in skus:
            try:
                sku_listings = [
                    listing
                    for listing in all_listings
                    if (
                        listing.printing == sku.printing.name
                        and listing.condition == sku.condition.name
                    )
                ]
                # Build per-SKU metrics (no per-SKU sales by default)
                item = _build_sku_item(sku, sku_listings, [])
                results.append(item)
            except Exception as e:
                print(f"Error processing SKU {sku.id}: {e}")
                continue
    except Exception as e:
        print(f"Error fetching listings for product {product_id}: {e}")
        return {"market_data_items": []}

    # Aggregate metrics using shared helper
    sales_request_data = CardSaleRequestData(
        product_id=tcgplayer_id,
        printings=[sku.printing.tcgplayer_id for sku in skus if sku.printing],
        conditions=[sku.condition.tcgplayer_id for sku in skus if sku.condition],
        languages=[sku.language.tcgplayer_id for sku in skus if sku.language],
    )
    sales_records = await get_sales(sales_request_data, timedelta(days=7))
    total_listings, total_quantity, sales_velocity, days_of_inventory = (
        _compute_aggregated_metrics(all_listings, sales_records)
    )
    return {"market_data_items": results}
