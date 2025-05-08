import uuid
from collections import defaultdict
from typing import List, Dict, Any

from fastapi import HTTPException  # Import HTTPException for error handling
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select

from core.models.catalog import SKU  # Import necessary models
from core.services.tcgplayer_listing_service import (
    get_product_active_listings,
    CardRequestData,
)

# Import necessary schemas from app routes (consider moving to core.schemas later if needed)
from app.routes.catalog.schemas import (
    SKUMarketDataResponseSchema,
    MarketDataSummary,
    SKUMarketDataItemResponseSchema,
    CumulativeDepthLevelResponseSchema,
)


def calculate_cumulative_depth_levels(
    listing_events: List[Dict[str, Any]],
) -> List[CumulativeDepthLevelResponseSchema]:
    """
    Helper function to calculate cumulative depth levels from a list of listing events.
    """
    depth_map: Dict[float, int] = defaultdict(int)
    for listing in listing_events:
        try:
            price = float(listing["price"])
            shipping_price = float(listing.get("shippingPrice", 0.0) or 0.0)
            quantity = int(listing.get("quantity", 0) or 0)

            if quantity > 0:
                total_price = round(price + shipping_price, 2)
                depth_map[total_price] += quantity
        except (TypeError, ValueError, KeyError) as e:
            print(f"Skipping listing due to data issue: {listing}, error: {e}")
            continue

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


async def get_market_data_for_sku(
    session: Session, sku_id: uuid.UUID
) -> SKUMarketDataResponseSchema:
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

    # 2. Prepare request and fetch data
    request_data = CardRequestData(
        product_id=sku.product.tcgplayer_id,
        printings=[sku.printing.name],
        conditions=[sku.condition.name],
    )

    # 3. Create response with default empty data
    cumulative_depth_levels = []

    try:
        # Fetch listings and calculate depth
        listings = await get_product_active_listings(request_data)
        cumulative_depth_levels = calculate_cumulative_depth_levels(listings)
    except Exception as e:
        print(f"Error fetching TCGPlayer listings for SKU {sku_id}: {e}")
        # Continue with empty depth levels

    # 4. Package into response schema
    return SKUMarketDataResponseSchema(
        summary=MarketDataSummary(),
        cumulative_depth_levels=cumulative_depth_levels,
        listings=[],
        sales=[],
    )


async def get_market_data_for_product(
    session: Session, product_id: uuid.UUID
) -> List[SKUMarketDataItemResponseSchema]:
    """
    Fetches market data for each SKU of a product, structured per marketplace.
    Makes a single API call for all SKUs to improve performance.
    Returns a list of SKUMarketDataItemSchema objects.
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
        return []

    # 2. Prepare for API request
    tcgplayer_id = skus[0].product.tcgplayer_id
    printings = list({sku.printing.name for sku in skus if sku.printing})
    conditions = list({sku.condition.name for sku in skus if sku.condition})

    results = []
    all_listings = []

    try:
        # 3. Make single API call for all SKUs
        request_data = CardRequestData(
            product_id=tcgplayer_id,
            printings=printings,
            conditions=conditions,
        )
        all_listings = await get_product_active_listings(request_data)

        # 4. Process data for each SKU
        for sku in skus:
            try:
                # Filter listings for this specific SKU
                sku_listings = [
                    listing
                    for listing in all_listings
                    if (
                        listing.get("printing") == sku.printing.name
                        and listing.get("condition") == sku.condition.name
                    )
                ]

                # Create market data for this SKU
                market_data_item = SKUMarketDataItemResponseSchema(
                    marketplace="TCGPlayer",
                    sku=sku,
                    market_data=SKUMarketDataResponseSchema(
                        summary=MarketDataSummary(),
                        cumulative_depth_levels=calculate_cumulative_depth_levels(
                            sku_listings
                        ),
                        listings=[],
                        sales=[],
                    ),
                )
                results.append(market_data_item)
            except Exception as e:
                print(f"Error processing SKU {sku.id}: {e}")
                continue
    except Exception as e:
        print(f"Error fetching listings for product {product_id}: {e}")
        # Return empty results list on API error

    return results
