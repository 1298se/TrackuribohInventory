from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.routes.catalog.schemas import (
    CatalogsResponseSchema,
    ProductSearchRequestParams,
    ProductWithSetAndSKUsResponseSchema,
    ProductSearchResponseSchema,
    ProductTypesResponseSchema,
    SKUMarketDataSchema,
    DepthLevel,
    MarketDataSummary,
)
from core.database import get_db_session
from core.models.catalog import Product
from core.models.catalog import Catalog
from core.models.catalog import Set
from core.models.catalog import SKU
from core.services.schemas.schema import ProductType
from core.utils.search import create_product_set_fts_vector, create_ts_query
from core.services.tcgplayer_listing_service import (
    get_product_active_listings,
    CardRequestData,
)

router = APIRouter(
    prefix="/catalog",
)


@router.get("/product/{product_id}", response_model=ProductWithSetAndSKUsResponseSchema)
async def get_product(product_id: str, session: Session = Depends(get_db_session)):
    product = session.get(Product, product_id)

    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")

    return product


@router.get("/search", response_model=ProductSearchResponseSchema)
def search_products(
    search_params: ProductSearchRequestParams = Depends(),
    session: Session = Depends(get_db_session),
):
    query_text = search_params.query
    catalog_id = search_params.catalog_id
    product_type = search_params.product_type

    # Use utility function to create combined TS vector for Product and Set
    combined_ts_vector_weighted = create_product_set_fts_vector()

    # Use utility function to create TS query
    ts_query = create_ts_query(query_text)

    # Define combined rank
    combined_rank = func.ts_rank(combined_ts_vector_weighted, ts_query)

    # Build search query
    base_search_query = (
        select(Product)
        .join(Set, Product.set_id == Set.id)
        .where(combined_ts_vector_weighted.op("@@")(ts_query))
    )

    # Add catalog filter if provided
    if catalog_id:
        base_search_query = base_search_query.where(Set.catalog_id == catalog_id)

    # Add product type filter if provided
    if product_type:
        base_search_query = base_search_query.where(
            Product.product_type == product_type
        )

    # Add ordering
    base_search_query = base_search_query.order_by(combined_rank.desc())

    # Execute query
    results = session.scalars(
        base_search_query.options(
            *ProductWithSetAndSKUsResponseSchema.get_load_options()
        )
    ).all()

    return ProductSearchResponseSchema(results=results)


@router.get("/catalogs", response_model=CatalogsResponseSchema)
def get_catalogs(session: Session = Depends(get_db_session)):
    """
    Endpoint to fetch all catalogs.
    """
    catalogs = session.scalars(select(Catalog).order_by(Catalog.display_name)).all()

    print(catalogs)

    return CatalogsResponseSchema(catalogs=catalogs)


@router.get("/product-types", response_model=ProductTypesResponseSchema)
def get_product_types(session: Session = Depends(get_db_session)):
    # Assuming ProductType is an Enum, return its values.
    return ProductTypesResponseSchema(product_types=list(ProductType))


@router.get(
    "/sku/{sku_id}/market-data",
    response_model=SKUMarketDataSchema,
    summary="Get market-depth data for a SKU variant",
)
async def get_sku_market_data(
    sku_id: str,
    days: int = 30,
    resolution: str = "daily",
    session: Session = Depends(get_db_session),
):
    """
    Return market-depth (price + shipping) data for a specific SKU variant.
    """
    # 1. Load SKU and its variant filters
    sku = session.get(SKU, sku_id)
    if not sku:
        raise HTTPException(status_code=404, detail="SKU not found")
    request_data = CardRequestData(
        product_id=sku.product.tcgplayer_id,
        printings=[sku.printing.name],
        conditions=[sku.condition.name],
    )

    # 2. Fetch raw listing events (ask-only)
    listing_events = await get_product_active_listings(request_data)

    # 3. Inline market depth aggregation (price + shippingPrice)
    depth_map: dict[float, int] = defaultdict(int)
    for listing in listing_events:
        total_price = float(listing["price"]) + float(listing.get("shippingPrice", 0))
        depth_map[total_price] += int(listing.get("quantity", 0))
    depth_levels = [
        DepthLevel(price=p, listing_count=c) for p, c in sorted(depth_map.items())
    ]

    # 4. Stubbed summary data for now
    summary = MarketDataSummary()

    return SKUMarketDataSchema(
        summary=summary,
        depth_levels=depth_levels,
        listings=[],  # future time-series data
        sales=[],  # future time-series data
    )
