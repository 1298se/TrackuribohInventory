import uuid
from collections import defaultdict
from typing import List, Dict, Any

from fastapi import HTTPException  # Import HTTPException for error handling
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, select

from core.models.catalog import SKU, Condition  # Import necessary models
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


async def get_market_data_for_sku(
    session: Session, sku_id: uuid.UUID
) -> SKUMarketDataResponseSchema:
    """
    Fetches market data (cumulative depth + summary) for a specific SKU ID.
    Raises HTTPException if SKU not found.
    """
    # 1. Load SKU with required relations for request_data
    # Use joinedload for related objects needed immediately
    sku = session.execute(
        select(SKU)
        .options(
            joinedload(SKU.product, innerjoin=True),  # Need product.tcgplayer_id
            joinedload(SKU.printing, innerjoin=True),  # Need printing.name
            joinedload(SKU.condition, innerjoin=True),  # Need condition.name
        )
        .where(SKU.id == sku_id)
    ).scalar_one_or_none()

    if not sku:
        raise HTTPException(status_code=404, detail=f"SKU not found: {sku_id}")

    # Ensure related objects are loaded (should be due to joinedload)
    if not all([sku.product, sku.printing, sku.condition]):
        # This case should ideally not happen with innerjoin=True
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load required SKU relations for {sku_id}",
        )

    # 2. Prepare request for TCGPlayer service
    request_data = CardRequestData(
        product_id=sku.product.tcgplayer_id,
        printings=[sku.printing.name],
        conditions=[sku.condition.name],
    )

    # 3. Fetch raw listing events
    listing_events: List[Dict[str, Any]] = []
    cumulative_depth_levels: List[CumulativeDepthLevelResponseSchema] = []
    try:
        listing_events = await get_product_active_listings(request_data)
    except Exception as e:
        # Log the error, but maybe return stubbed data instead of raising 500?
        # For now, re-raise or handle as internal server error potential?
        print(f"Error fetching TCGPlayer listings for SKU {sku_id}: {e}")
        # Returning empty depth for now on TCGPlayer error
        cumulative_depth_levels = []
        # Alternative: raise HTTPException(status_code=503, detail="Failed to fetch market listings")

    else:
        # 4. Aggregate depth (only if fetch was successful)
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
                print(
                    f"Skipping listing for SKU {sku_id} due to data issue: {listing}, error: {e}"
                )
                continue
        # Calculate cumulative depth levels directly
        current_cumulative_count = 0
        for price in sorted(depth_map.keys()):
            current_cumulative_count += depth_map[price]
            cumulative_depth_levels.append(
                CumulativeDepthLevelResponseSchema(
                    price=price, cumulative_count=current_cumulative_count
                )
            )

    # 6. Stubbed summary data
    summary = MarketDataSummary()

    # 7. Package into SKUMarketDataSchema
    sku_market_data = SKUMarketDataResponseSchema(
        summary=summary,
        cumulative_depth_levels=cumulative_depth_levels,
        listings=[],  # future time-series data
        sales=[],  # future time-series data
    )

    return sku_market_data  # Return the data directly


async def get_market_data_for_product(
    session: Session, product_id: uuid.UUID
) -> List[SKUMarketDataItemResponseSchema]:
    """
    Fetches market data for each Near Mint SKU of a product, structured per marketplace.
    Returns a list of SKUMarketDataItemSchema objects.
    """
    # 1. Load Product and related Near Mint SKU objects (including relations needed for SKUBaseResponseSchema)
    # This query needs to fetch the actual SKU objects, not just IDs, to return in the final schema.
    near_mint_skus_query = (
        select(SKU)
        .join(SKU.condition)
        .options(
            # Eager load relations needed for SKUBaseResponseSchema serialization
            joinedload(SKU.printing),
            joinedload(SKU.language),
            joinedload(SKU.condition),  # Already joined, but ensure it's loaded
            # We don't strictly need Product here as get_market_data_for_sku loads it again,
            # but could optimize later if needed.
        )
        .where(
            SKU.product_id == product_id,
            or_(Condition.name == "Near Mint", Condition.name == "Unopened"),
        )
        .order_by(SKU.id)  # Consistent ordering
    )
    near_mint_skus: List[SKU] = session.scalars(near_mint_skus_query).all()

    if not near_mint_skus:
        print(f"No Near Mint SKUs found for product: {product_id}")
        return []

    results: List[SKUMarketDataItemResponseSchema] = []

    # 2. Iterate through each Near Mint SKU object
    for sku in near_mint_skus:
        try:
            # Call the SKU-specific service function to get the market data
            sku_market_data = await get_market_data_for_sku(
                session=session, sku_id=sku.id
            )

            # Construct the item including marketplace identifier
            market_data_item = SKUMarketDataItemResponseSchema(
                marketplace="TCGPlayer",  # Hardcoded for now
                sku=sku,  # Pass the full SKU object for serialization
                market_data=sku_market_data,
            )
            results.append(market_data_item)

        except HTTPException as e:
            print(
                f"Skipping market data for SKU {sku.id} (Product {product_id}) due to error: {e.detail}"
            )
            continue
        except Exception as e:
            print(
                f"Unexpected error getting market data for SKU {sku.id} (Product {product_id}): {e}"
            )
            continue

    return results
