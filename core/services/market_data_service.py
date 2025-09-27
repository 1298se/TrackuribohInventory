import asyncio
from dataclasses import dataclass
import uuid
from collections import defaultdict
from typing import List, Dict, Optional, Tuple
from datetime import timedelta
import math
import statistics
from decimal import Decimal

from fastapi import Depends
from sqlalchemy.orm import Session, joinedload, load_only
from sqlalchemy import select

from core.models.catalog import (
    SKU,
    Product,
    Printing,
    Condition,
    Language,
)  # Import necessary models
from core.models.price import Marketplace
from core.services.tcgplayer_listing_service import (
    CardListingRequestData,
    CardSaleRequestData,
    get_tcgplayer_listing_service,
    TCGPlayerListingService,
)
from core.services.schemas.tcgplayer import (
    TCGPlayerListingSchema,
    TCGPlayerSaleSchema,
)
import logging

logger = logging.getLogger(__name__)


# Service DTOs - frozen dataclasses for immutable data transfer
@dataclass(frozen=True)
class CumulativeDepthLevel:
    """Represents a price level with cumulative count."""

    price: float
    cumulative_count: int


@dataclass(frozen=True)
class SKUMarketData:
    """Market data for a single SKU in one marketplace."""

    sku_id: str
    total_listings: int
    total_quantity: int
    total_sales: int
    sales_velocity: float
    cumulative_depth_levels: List[CumulativeDepthLevel]
    cumulative_sales_depth_levels: List[CumulativeDepthLevel]
    days_of_inventory: Optional[float] = None


class SkuNotFoundError(Exception):
    pass


def _prune_price_outliers(
    listings: List[TCGPlayerListingSchema], z_threshold: float = 3.0
) -> List[TCGPlayerListingSchema]:
    """
    Remove outlier listings based on log-transformed z-scores to handle skewed price distributions.

    Args:
        listings: List of listings to be filtered
        z_threshold: Maximum absolute z-score to include (default: 3.0)

    Returns:
        Filtered list with outliers removed
    """
    if len(listings) <= 2:  # Not enough data points to meaningfully detect outliers
        return listings

    # Calculate total prices (item + shipping)
    prices = [listing.price + listing.shipping_price for listing in listings]

    # Apply log transformation to handle right-skewed distribution
    log_prices = [math.log(max(0.01, float(price))) for price in prices]  # Avoid log(0)

    # Calculate mean and standard deviation of log prices
    try:
        mean_log = statistics.mean(log_prices)
        std_log = statistics.stdev(log_prices)

        # If standard deviation is too small or zero, don't filter
        if std_log < 0.001:
            return listings

        # Filter listings based on z-score
        filtered_listings = []
        for i, listing in enumerate(listings):
            z_score = abs((log_prices[i] - mean_log) / std_log)
            if z_score <= z_threshold:
                filtered_listings.append(listing)

        # If we filtered too aggressively (e.g., kept less than 50% of listings),
        # return original listings to be safe
        if len(filtered_listings) < len(listings) * 0.5:
            return listings

        return filtered_listings

    except (statistics.StatisticsError, ZeroDivisionError):
        # If any statistical calculation fails, return original data
        return listings


def calculate_cumulative_depth_levels(
    listing_events: List[TCGPlayerListingSchema],
) -> List[CumulativeDepthLevel]:
    """
    Helper function to calculate cumulative depth levels from a list of listing events.
    """
    depth_map: Dict[float, int] = defaultdict(int)
    for listing in listing_events:
        # Compute delivered price and round to cents, convert to float once for key
        total_price = float(
            (listing.price + listing.shipping_price).quantize(Decimal("0.01"))
        )
        quantity = listing.quantity
        if quantity > 0:
            depth_map[total_price] += quantity

    # Calculate cumulative depth levels
    cumulative_depth_levels = []
    current_cumulative_count = 0
    for price in sorted(depth_map.keys()):
        current_cumulative_count += depth_map[price]
        cumulative_depth_levels.append(
            CumulativeDepthLevel(price=price, cumulative_count=current_cumulative_count)
        )

    return cumulative_depth_levels


# Add helper for cumulative sales depth levels
def calculate_cumulative_sales_depth_levels(
    sales_records: List[TCGPlayerSaleSchema],
) -> List[CumulativeDepthLevel]:
    """
    Helper function to calculate cumulative depth levels from a list of sale records.
    Sales are accumulated from highest price to lowest price (different from listings).
    """
    depth_map: Dict[float, int] = defaultdict(int)
    for sale in sales_records:
        # Sum purchase and shipping price; round to cents and convert to float once
        price = float(
            (sale.purchase_price + sale.shipping_price).quantize(Decimal("0.01"))
        )
        quantity = sale.quantity
        if quantity > 0:
            depth_map[price] += quantity

    cumulative_sales_depth_levels: List[CumulativeDepthLevel] = []
    current_cumulative_count = 0
    # Reverse sort (descending) to accumulate from highest price to lowest price
    for price in sorted(depth_map.keys(), reverse=True):
        current_cumulative_count += depth_map[price]
        cumulative_sales_depth_levels.append(
            CumulativeDepthLevel(
                price=price,
                cumulative_count=current_cumulative_count,
            )
        )
    return cumulative_sales_depth_levels


# Shared helper to compute aggregate metrics for market data endpoints
def _compute_aggregated_metrics(
    listings: List[TCGPlayerListingSchema],
    sales_records: List[TCGPlayerSaleSchema],
    days: int = 7,
) -> tuple[int, int, int, float, Optional[float]]:
    """
    Compute total listings, total quantity, total sales, average daily sales velocity, and days of inventory.
    """
    total_quantity = sum(listing.quantity for listing in listings)
    total_listings = len(listings)
    total_sales = sum(sale.quantity for sale in sales_records)
    sales_velocity_daily_avg = total_sales / days if days > 0 else 0.0
    days_of_inventory: Optional[float] = None
    if sales_velocity_daily_avg > 0 and total_quantity > 0:
        days_of_inventory = round(total_quantity / sales_velocity_daily_avg, 1)
    return (
        total_listings,
        total_quantity,
        total_sales,
        round(sales_velocity_daily_avg, 2),
        days_of_inventory,
    )


def _build_sku_item(
    sku: SKU,
    listings: List[TCGPlayerListingSchema],
    sales_records: List[TCGPlayerSaleSchema],
    marketplace: str = "TCGPlayer",
    sales_lookback_days: int = 7,
) -> SKUMarketData:
    """Helper to build SKUMarketData for one SKU & marketplace."""
    # Apply outlier detection to listings before calculating depth levels
    pruned_listings = _prune_price_outliers(listings)

    depth_levels = calculate_cumulative_depth_levels(pruned_listings)
    # Calculate cumulative sales depth levels as well
    sales_depth_levels = calculate_cumulative_sales_depth_levels(sales_records)
    total_listings, total_quantity, total_sales, sales_velocity, days_of_inventory = (
        _compute_aggregated_metrics(listings, sales_records, sales_lookback_days)
    )

    return SKUMarketData(
        sku_id=str(sku.id),
        total_listings=total_listings,
        total_quantity=total_quantity,
        total_sales=total_sales,
        sales_velocity=sales_velocity,
        days_of_inventory=days_of_inventory,
        cumulative_depth_levels=depth_levels,
        cumulative_sales_depth_levels=sales_depth_levels,
    )


class MarketDataService:
    """Thin service wrapper for market data operations with DI for upstream services."""

    def __init__(self, tcgplayer_listing_service: TCGPlayerListingService):
        self.tcgplayer_listing_service = tcgplayer_listing_service

    async def _fetch_listings_and_sales(
        self,
        listing_request_data: CardListingRequestData,
        sales_request_data: CardSaleRequestData,
        sales_lookback_days: int,
    ) -> Tuple[List[TCGPlayerListingSchema], List[TCGPlayerSaleSchema]]:
        """
        Fetch listings and sales data concurrently from TCGPlayer API.
        Raises exceptions if either API call fails.
        """
        listings_task = self.tcgplayer_listing_service.get_product_active_listings(
            listing_request_data
        )
        sales_task = self.tcgplayer_listing_service.get_sales(
            sales_request_data, timedelta(days=sales_lookback_days)
        )

        try:
            listings, sales_records = await asyncio.gather(listings_task, sales_task)
            return listings, sales_records
        except Exception as e:
            logger.error(f"Failed to fetch TCGPlayer data: {e}")
            raise

    async def get_market_data_for_sku(
        self,
        session: Session,
        sku_id: uuid.UUID,
        sales_lookback_days: int = 30,
    ) -> Dict[Marketplace, List[SKUMarketData]]:
        """
        Fetches market data (cumulative depth + summary) for a specific SKU ID.
        Raises SkuNotFoundError if SKU not found.
        """
        sku = session.execute(
            select(SKU)
            .options(
                joinedload(SKU.product, innerjoin=True),
                joinedload(SKU.printing, innerjoin=True),
                joinedload(SKU.condition, innerjoin=True),
                joinedload(SKU.language, innerjoin=True),
            )
            .where(SKU.id == sku_id)
        ).scalar_one()

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

        # Fetch listings and sales concurrently - fail fast if either fails
        listings, sales_records = await self._fetch_listings_and_sales(
            listing_request_data, sales_request_data, sales_lookback_days
        )

        item = _build_sku_item(
            sku,
            listings,
            sales_records,
            marketplace="TCGPlayer",
            sales_lookback_days=sales_lookback_days,
        )
        return {Marketplace.TCGPLAYER: [item]}

    async def get_market_data_for_product(
        self,
        session: Session,
        product_id: uuid.UUID,
        sales_lookback_days: int = 30,
    ) -> Dict[Marketplace, List[SKUMarketData]]:
        """
        Fetches market data for each SKU of a product, structured per marketplace.
        Makes a single API call for all SKUs to improve performance.
        Returns a dictionary with market_data_items and aggregated metrics.
        """
        skus = session.scalars(
            select(SKU)
            .options(
                load_only(
                    SKU.id,
                    SKU.product_id,
                    SKU.printing_id,
                    SKU.condition_id,
                    SKU.language_id,
                ),
                joinedload(SKU.product).load_only(Product.tcgplayer_id),
                joinedload(SKU.printing).load_only(Printing.name),
                joinedload(SKU.condition).load_only(Condition.name),
                joinedload(SKU.language).load_only(Language.name),
            )
            .where(SKU.product_id == product_id)
            .order_by(SKU.id)
        ).all()

        if not skus:
            logger.info(f"No SKUs found for product: {product_id}")
            return {}

        tcgplayer_id = skus[0].product.tcgplayer_id

        listing_request_data = CardListingRequestData(
            product_id=tcgplayer_id,
        )
        sales_request_data = CardSaleRequestData(
            product_id=tcgplayer_id,
        )

        # Fetch listings and sales concurrently - fail fast if either fails
        all_listings, all_sales_records = await self._fetch_listings_and_sales(
            listing_request_data, sales_request_data, sales_lookback_days
        )

        results: List[SKUMarketData] = []
        for sku in skus:
            sku_listings = [
                listing
                for listing in all_listings
                if (
                    listing.printing == sku.printing.name
                    and listing.condition == sku.condition.name
                )
            ]
            sku_sales_records = [
                sale
                for sale in all_sales_records
                if (
                    sale.variant == sku.printing.name
                    and sale.condition == sku.condition.name
                    and sale.language == sku.language.name
                )
            ]
            item = _build_sku_item(
                sku,
                sku_listings,
                sku_sales_records,
                marketplace="TCGPlayer",
                sales_lookback_days=sales_lookback_days,
            )
            results.append(item)

        return {Marketplace.TCGPLAYER: results}


def get_market_data_service(
    tcgplayer_listing_service: TCGPlayerListingService = Depends(
        get_tcgplayer_listing_service
    ),
) -> MarketDataService:
    return MarketDataService(tcgplayer_listing_service)
