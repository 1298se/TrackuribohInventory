import logging
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import List, Optional, Dict, Tuple
from dataclasses import dataclass
from collections import defaultdict

from core.database import SessionLocal

from core.models.decisions import BuyDecision, Decision
from core.models.price import Marketplace
from core.services.tcgplayer_listing_service import (
    CardListingRequestData,
    TCGPlayerListingService,
)
from core.services.tcgplayer_types import TCGPlayerListing
from core.dao.sales import get_recent_sales_for_skus
from core.dao.buy_decision import insert_buy_decisions, BuyDecisionData
from core.models.listings import SaleRecord
from core.utils.request_pacer import RequestPacer
from core.services.sku_selection import ProcessingSKU
from core.services.sales_sync_sweep_service import ProductProcessingGroup
from aiohttp import ClientResponseError

logger = logging.getLogger(__name__)

# Algorithm parameters (hardcoded for simplicity)
ASP_MIN_THRESHOLD = Decimal("2.00")  # $2 minimum ASP gate
EDGE_MIN_ABS = Decimal("1.25")  # $1.25 minimum absolute edge per unit
EDGE_MIN_PCT = Decimal("0.08")  # 8% minimum edge percentage
TIME_HORIZON_DAYS = 14  # T = 14 days exit horizon
SALES_WINDOW_DAYS = 14  # W = 14 days sales window
UNDERCUT_PCT = Decimal("0.025")  # 2.5% undercut for resale nowcast
FEE_RATE_TOTAL = Decimal("0.13")  # 13% total fees (TCGPlayer + payment + misc)
SHIP_OUT_PER_UNIT = Decimal("1.50")  # Conservative outbound shipping cost
PACK_PER_UNIT = Decimal("0.25")  # Packaging cost per unit
CLIFF_THRESHOLD = 0.08  # 8% max price cliff
SELLER_CONCENTRATION_MAX = 0.70  # 70% max concentration from top seller
TREND_DOWN_CAP = 0.10  # 10% max down haircut
TREND_UP_CAP = 0.03  # 3% max up boost
BLEND_ALPHA_MAX = 0.5  # Max blend factor toward ask


@dataclass
class MarketData:
    """Container for fresh market data used in decision computation."""

    sku_id: uuid.UUID
    marketplace: Marketplace
    listings: List[TCGPlayerListing]
    sales: List[SaleRecord]
    asof_listings: datetime
    asof_sales: datetime


@dataclass
class AlgorithmResult:
    """Intermediate results from algorithm computation."""

    passed_asp_gate: bool
    best_ask: Optional[Decimal]
    buy_vwap_curve: Dict[int, Decimal]  # qty -> vwap
    resale_nowcast: Decimal
    lambda_hat: float
    sell_through_ok: bool
    safety_rails_ok: bool
    optimal_qty: int
    optimal_edge_total: Decimal
    reason_codes: List[str]


def apply_asp_gate(
    listings: List[TCGPlayerListing],
) -> Tuple[bool, Optional[Decimal]]:
    """
    Apply ASP (Average Selling Price) gate - filter by minimum threshold.

    Returns:
        (passed_gate, best_delivered_ask)
    """
    if not listings:
        return False, None

    # Calculate delivered ask (price + shipping) for each listing
    delivered_asks = []
    for listing in listings:
        delivered_ask = listing.price + listing.shipping_price
        delivered_asks.append(delivered_ask)

    best_ask = min(delivered_asks)
    passed = best_ask >= ASP_MIN_THRESHOLD

    if not passed:
        logger.debug(f"Failed ASP gate: best ask {best_ask} < {ASP_MIN_THRESHOLD}")

    return passed, best_ask


def compute_buy_ladder(
    listings: List[TCGPlayerListing], cap: int
) -> Dict[int, Decimal]:
    """
    Compute buy ladder - VWAP at different quantity levels up to a demand-based cap.

    Returns:
        Dict mapping quantity -> VWAP (delivered cost per unit)
    """
    if not listings or cap <= 0:
        return {}

    # Sort listings by delivered unit cost (price + shipping)
    sorted_listings = []
    for listing in listings:
        delivered_cost = listing.price + listing.shipping_price
        quantity = listing.quantity
        sorted_listings.append((delivered_cost, quantity))

    sorted_listings.sort(key=lambda x: x[0])  # Sort by cost ascending

    # Build cumulative cost curve
    vwap_curve = {}
    cumulative_cost = Decimal("0")
    cumulative_qty = 0

    for cost_per_unit, available_qty in sorted_listings:
        for _ in range(available_qty):
            if cumulative_qty >= cap:
                break
            new_cumulative_cost = cumulative_cost + cost_per_unit
            new_cumulative_qty = cumulative_qty + 1
            vwap = new_cumulative_cost / new_cumulative_qty
            vwap_curve[new_cumulative_qty] = vwap
            cumulative_cost = new_cumulative_cost
            cumulative_qty = new_cumulative_qty
        if cumulative_qty >= cap:
            break

    return vwap_curve


def compute_resale_nowcast(
    sales: List[SaleRecord], best_ask: Optional[Decimal]
) -> Decimal:
    """
    Compute resale nowcast using sales-anchored approach with trend adjustments.

    Returns:
        Expected resale price per unit
    """
    if not sales:
        logger.debug("No sales data for resale nowcast")
        return Decimal("0")

    # Calculate recent sales median/VWAP (simplified - using median)
    recent_prices = []
    for sale in sales:
        # DB shape: SalesListing(sale_price, shipping_price)
        base_price = sale.sale_price
        shipping = sale.shipping_price or Decimal("0")
        price_value = base_price + shipping
        recent_prices.append(price_value)

    if not recent_prices:
        logger.debug("No usable sales price data for resale nowcast")
        return Decimal("0")

    recent_prices.sort()

    if len(recent_prices) % 2 == 0:
        median_idx = len(recent_prices) // 2
        sales_anchor = (recent_prices[median_idx - 1] + recent_prices[median_idx]) / 2
    else:
        sales_anchor = recent_prices[len(recent_prices) // 2]

    # Simple trend calculation (placeholder - could be enhanced)
    # For now, assume no trend adjustment
    beta = 0.0  # Daily slope percentage

    # Start with sales anchor
    nowcast = sales_anchor

    # Apply trend haircut if declining
    if beta < 0:
        down_haircut = min(abs(beta) * TIME_HORIZON_DAYS, TREND_DOWN_CAP)
        nowcast *= Decimal("1") - down_haircut

    # Blend toward best ask if conditions met (simplified logic)
    if best_ask and abs((best_ask / sales_anchor) - 1) <= Decimal("0.05"):  # Within 5%
        # Simple blend with conservative alpha
        alpha = Decimal("0.2")  # Conservative blend factor
        nowcast = (
            sales_anchor * (Decimal("1") - alpha)
            + best_ask * (Decimal("1") - UNDERCUT_PCT) * alpha
        )

    return nowcast


def estimate_sell_through(sales: List[SaleRecord]) -> Tuple[float, bool]:
    """
    Estimate sell-through rate (lambda_hat) based on total units sold and validate liquidity.

    Returns:
        (lambda_hat_per_day, liquidity_adequate)
    """
    if not sales:
        return 0.0, False

    # Use total units sold over the window, not number of sales rows
    total_units_sold = sum(sale.quantity for sale in sales)

    # Simple rate estimation: units_sold / days_window
    lambda_hat = total_units_sold / SALES_WINDOW_DAYS

    # Liquidity checks based on units sold (minimum 3 units in window)
    liquidity_adequate = total_units_sold >= 3

    return lambda_hat, liquidity_adequate


def apply_safety_rails(
    listings: List[TCGPlayerListing], qty: int, vwap_curve: Dict[int, Decimal]
) -> Tuple[bool, List[str]]:
    """
    Apply safety rails: seller concentration.

    Returns:
        (safety_ok, reason_codes)
    """
    reason_codes = []

    # Check seller concentration (simplified)
    if listings:
        # Group by seller and check concentration
        seller_quantities = {}
        total_available = 0

        for listing in listings:
            seller_key = listing.seller_id
            qty_available = listing.quantity
            seller_quantities[seller_key] = (
                seller_quantities.get(seller_key, 0) + qty_available
            )
            total_available += qty_available

        if total_available > 0:
            max_seller_share = max(seller_quantities.values()) / total_available
            if max_seller_share > SELLER_CONCENTRATION_MAX:
                reason_codes.append("SELLER_CONCENTRATION")

    safety_ok = len(reason_codes) == 0
    return safety_ok, reason_codes


def optimize_quantity(
    vwap_curve: Dict[int, Decimal], resale_net: Decimal, lambda_hat: float
) -> Tuple[int, Decimal]:
    """
    Find optimal quantity that maximizes total edge.

    Returns:
        (optimal_qty, total_edge)
    """
    if not vwap_curve or resale_net <= 0:
        return 0, Decimal("0")

    demand_cap = max(1, int(lambda_hat * TIME_HORIZON_DAYS))
    max_qty = min(max(vwap_curve.keys()), demand_cap)
    best_qty = 0
    best_total_edge = Decimal("0")

    for qty in range(1, max_qty + 1):
        if qty not in vwap_curve:
            continue

        buy_cost = vwap_curve[qty]
        edge_per_unit = resale_net - buy_cost

        # Check minimum edge thresholds
        if edge_per_unit < EDGE_MIN_ABS:
            continue
        if (edge_per_unit / buy_cost) < EDGE_MIN_PCT:
            continue

        total_edge = edge_per_unit * qty
        if total_edge > best_total_edge:
            best_total_edge = total_edge
            best_qty = qty

    return best_qty, best_total_edge


def compute_sales_asp_median(sales: List[SaleRecord]) -> Optional[Decimal]:
    """
    Compute median delivered sale price (sale_price + shipping_price) from recent sales.
    Returns None if no sales.
    """
    if not sales:
        return None

    delivered_prices: List[Decimal] = []
    for sale in sales:
        base_price = sale.sale_price
        shipping = sale.shipping_price or Decimal("0")
        delivered_prices.append(base_price + shipping)

    if not delivered_prices:
        return None

    delivered_prices.sort()
    if len(delivered_prices) % 2 == 0:
        mid = len(delivered_prices) // 2
        return (delivered_prices[mid - 1] + delivered_prices[mid]) / 2
    else:
        return delivered_prices[len(delivered_prices) // 2]


def compute_purchase_decision(market_data: MarketData) -> BuyDecision:
    """
    Main algorithm: compute buy/pass decision for a SKU based on fresh market data.

    Args:
        market_data: Fresh listings and sales data for the SKU

    Returns:
        BuyDecision with recommendation and supporting data
    """
    logger.debug(f"Computing purchase decision for SKU {market_data.sku_id}")

    reason_codes = []

    # Compute best ask from listings only for blending (not for gating)
    best_ask: Optional[Decimal] = None
    if market_data.listings:
        delivered_asks: List[Decimal] = []
        for listing in market_data.listings:
            delivered_ask = listing.price + listing.shipping_price
            delivered_asks.append(delivered_ask)
        if delivered_asks:
            best_ask = min(delivered_asks)

    # Step 1: Liquidity Check (needed for demand-based ladder cap)
    lambda_hat, liquidity_ok = estimate_sell_through(market_data.sales)
    if not liquidity_ok:
        reason_codes.append("LOW_LIQUIDITY")
    demand_cap = max(1, int(lambda_hat * TIME_HORIZON_DAYS))

    # Step 2: Buy Ladder up to demand cap
    vwap_curve = compute_buy_ladder(market_data.listings, demand_cap)
    if not vwap_curve:
        reason_codes.append("NO_LISTINGS")
        return BuyDecision(
            sku_id=market_data.sku_id,
            decision=Decision.PASS,
            quantity=0,
            buy_vwap=Decimal("0"),
            expected_resale_net=Decimal("0"),
            asof_listings=market_data.asof_listings,
            asof_sales=market_data.asof_sales,
            reason_codes=reason_codes,
        )

    # Step 3: Resale Nowcast
    resale_gross = compute_resale_nowcast(market_data.sales, best_ask)
    resale_net = (
        resale_gross * (Decimal("1") - FEE_RATE_TOTAL)
        - SHIP_OUT_PER_UNIT
        - PACK_PER_UNIT
    )

    # Step 4: Find optimal quantity with safety rails
    optimal_qty, total_edge = optimize_quantity(vwap_curve, resale_net, lambda_hat)

    if optimal_qty == 0:
        reason_codes.append("NEG_EDGE")
    else:
        # Apply safety rails
        safety_ok, safety_reasons = apply_safety_rails(
            market_data.listings, optimal_qty, vwap_curve
        )
        if not safety_ok:
            reason_codes.extend(safety_reasons)
            optimal_qty = 0
            Decimal("0")

    # Final decision
    if optimal_qty > 0 and liquidity_ok and not reason_codes:
        decision = Decision.BUY
        buy_vwap = vwap_curve[optimal_qty]
    else:
        decision = Decision.PASS
        buy_vwap = Decimal("0")
        optimal_qty = 0

    return BuyDecision(
        sku_id=market_data.sku_id,
        decision=decision,
        quantity=optimal_qty,
        buy_vwap=buy_vwap,
        expected_resale_net=resale_net,
        asof_listings=market_data.asof_listings,
        asof_sales=market_data.asof_sales,
        reason_codes=reason_codes if reason_codes else [],
    )


@dataclass
class PurchaseDecisionResult:
    sku_id: uuid.UUID
    buy_decision: BuyDecision
    sales_count: int
    listings_count: int
    decision: str  # "BUY" or "PASS"
    quantity: int
    buy_vwap: Optional[Decimal]
    expected_resale_net: Optional[Decimal]
    reason_codes: List[str]


async def process_product_with_request_slot(
    product_group: ProductProcessingGroup,
    marketplace: Marketplace,
    sales_data_by_sku: Dict[uuid.UUID, List[SaleRecord]],
    tcgplayer_listing_service: TCGPlayerListingService,
) -> List[PurchaseDecisionResult]:
    """Process all SKUs in a product group for purchase decisions with single API call.
    Raises exceptions on HTTP or processing errors; caller is responsible for handling.
    """

    results: List[PurchaseDecisionResult] = []
    product_tcgplayer_id = product_group.product_tcgplayer_id
    skus_in_product = product_group.skus

    # Create request data for listings API (single call for entire product)
    listings_request = CardListingRequestData(product_id=product_tcgplayer_id)

    # Fetch listings data for entire product (let exceptions propagate)
    asof_listings = datetime.now(timezone.utc)
    listings_responses = await tcgplayer_listing_service.get_product_active_listings(
        listings_request
    )

    # Process each SKU in the product using the shared listings data
    asof_sales = datetime.now(timezone.utc)

    for sku in skus_in_product:
        # Get sales data for this SKU (from pre-loaded cache)
        sku_sales_data = sales_data_by_sku.get(sku.sku_id, [])

        sku_listings = [
            listing
            for listing in listings_responses
            if listing.product_condition_id == sku.sku_tcgplayer_id
        ]

        # Create market data for decision computation
        market_data = MarketData(
            sku_id=sku.sku_id,
            marketplace=marketplace,
            listings=sku_listings,
            sales=sku_sales_data,
            asof_listings=asof_listings,
            asof_sales=asof_sales,
        )

        # Compute purchase decision
        decision = compute_purchase_decision(market_data)

        results.append(
            PurchaseDecisionResult(
                sku_id=sku.sku_id,
                buy_decision=decision,
                sales_count=sum(s.quantity for s in sku_sales_data),
                listings_count=len(sku_listings),
                decision=decision.decision.value,
                quantity=decision.quantity,
                buy_vwap=decision.buy_vwap,
                expected_resale_net=decision.expected_resale_net,
                reason_codes=decision.reason_codes,
            )
        )

    return results


async def run_purchase_decision_sweep(
    marketplace: Marketplace,
    processing_list: List[ProcessingSKU],
) -> None:
    """
    Run the purchase decision sweep with pre-computed processing list using per-product processing.

    Args:
        marketplace: Marketplace to process
        processing_list: Pre-computed list of ProcessingSKU objects

    Returns:
        None
    """
    datetime.now(timezone.utc)
    len(processing_list)

    # Configure request pacer with defaults (burst-only)
    request_pacer = RequestPacer()
    logger.debug("Using default burst pacing")

    served_skus = set()
    results: List[PurchaseDecisionResult] = []
    total_successes = 0
    failures = 0

    # Pre-load all recent sales data for efficient decision processing
    sales_cutoff = datetime.now(timezone.utc) - timedelta(days=SALES_WINDOW_DAYS)

    # Get all SKU IDs from processing list
    all_candidate_skus = [item.sku_id for item in processing_list]

    logger.debug(
        f"Pre-loading sales data for {len(all_candidate_skus)} SKUs from processing list (last {SALES_WINDOW_DAYS} days)"
    )
    with SessionLocal() as session:
        sales_by_sku = get_recent_sales_for_skus(
            session, all_candidate_skus, marketplace, sales_cutoff
        )
    logger.debug(f"Loaded sales data for {len(sales_by_sku)} SKUs")

    # Sales-based ASP pre-gate to avoid unnecessary listings calls
    filtered_processing_list: List[ProcessingSKU] = []
    skipped_for_low_asp = 0
    for sku in processing_list:
        sku_sales = sales_by_sku.get(sku.sku_id, [])
        sales_median = compute_sales_asp_median(sku_sales)
        if sales_median is None or sales_median < ASP_MIN_THRESHOLD:
            skipped_for_low_asp += 1
            continue
        filtered_processing_list.append(sku)

    if skipped_for_low_asp > 0:
        logger.debug(
            f"ASP pre-gate skipped {skipped_for_low_asp} SKUs below threshold {ASP_MIN_THRESHOLD} based on sales"
        )

    # Group SKUs by product_tcgplayer_id for per-product processing, using filtered list
    product_groups: Dict[int, List[ProcessingSKU]] = defaultdict(list)
    for sku in filtered_processing_list:
        product_groups[sku.product_tcgplayer_id].append(sku)

    # Convert to ProductProcessingGroup objects
    product_processing_groups = [
        ProductProcessingGroup(product_tcgplayer_id=pid, skus=skus)
        for pid, skus in product_groups.items()
    ]

    product_count = len(product_processing_groups)
    logger.debug(
        f"Grouped {len(filtered_processing_list)} filtered SKUs into {product_count} products for processing"
    )

    # Accumulators for batched DB writes
    all_decisions: List[BuyDecisionData] = []

    # Process by product groups instead of individual SKUs
    processing_index = 0
    async for _ in request_pacer.create_schedule(product_count):
        # Check if we've processed all product groups
        if processing_index >= len(product_processing_groups):
            logger.debug("All product groups have been processed")
            break

        product_group = product_processing_groups[processing_index]

        try:
            # Process the entire product group (makes 1 API call for listings)
            product_results = await process_product_with_request_slot(
                product_group=product_group,
                marketplace=marketplace,
                sales_data_by_sku=sales_by_sku,
            )

            # Success path for all SKUs in this product
            for result in product_results:
                results.append(result)
                served_skus.add(result.sku_id)
                # Convert BuyDecision to BuyDecisionData for batch insert
                decision_data = BuyDecisionData(
                    sku_id=result.buy_decision.sku_id,
                    decision=result.buy_decision.decision,
                    quantity=result.buy_decision.quantity,
                    buy_vwap=result.buy_decision.buy_vwap,
                    expected_resale_net=result.buy_decision.expected_resale_net,
                    asof_listings=result.buy_decision.asof_listings,
                    asof_sales=result.buy_decision.asof_sales,
                    reason_codes=result.buy_decision.reason_codes,
                )
                all_decisions.append(decision_data)
                total_successes += 1

            logger.debug(
                f"Processed product {product_group.product_tcgplayer_id} with {len(product_results)} SKUs"
            )

            processing_index += 1

            if total_successes % 100 == 0:
                logger.debug(
                    f"Purchase decisions: {total_successes} completed across {processing_index} products"
                )

        except ClientResponseError as e:
            failures += 1
            logger.warning(
                f"HTTP error processing product {product_group.product_tcgplayer_id}: {e.status}"
            )
            if e.status == 403:
                request_pacer.on_rate_limited()
                await request_pacer.cooldown()
            processing_index += 1
            continue

    if all_decisions:
        with SessionLocal.begin() as session:
            insert_buy_decisions(session, all_decisions)

    logger.info("Purchase decision sweep completed")
    return None
