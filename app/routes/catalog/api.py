from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import Session, joinedload

from app.routes.catalog.schemas import (
    CatalogsResponseSchema,
    ProductSearchRequestParams,
    ProductWithSetAndSKUsResponseSchema,
    ProductSearchResponseSchema,
    ProductTypesResponseSchema,
    SetsResponseSchema,
    MarketDataResponseSchema,
)
from core.database import get_db_session
from core.models.catalog import Product, SKU
from core.models.catalog import Catalog
from core.models.catalog import Set
from core.models.price import SKULatestPrice, Marketplace
from core.services.schemas.schema import ProductType
from core.dao.catalog import build_product_search_query

router = APIRouter(
    prefix="/catalog",
)


@router.get("/product/{product_id}", response_model=ProductWithSetAndSKUsResponseSchema)
async def get_product(product_id: str, session: Session = Depends(get_db_session)):
    # Use a single query with LEFT JOIN to get product, SKUs, and prices efficiently
    result = session.execute(
        select(Product, SKU, SKULatestPrice.lowest_listing_price_total)
        .select_from(Product)
        .join(Product.skus)
        .outerjoin(
            SKULatestPrice,
            (SKULatestPrice.sku_id == SKU.id)
            & (SKULatestPrice.marketplace == Marketplace.TCGPLAYER),
        )
        .options(
            joinedload(Product.set),
            joinedload(SKU.condition),
            joinedload(SKU.printing),
            joinedload(SKU.language),
        )
        .where(Product.id == product_id)
    ).all()

    if not result:
        raise HTTPException(status_code=404, detail="Product not found")

    # Group results by product and build the response
    product = result[0][0]  # First row, first column (Product)

    # Create a mapping of sku_id to price
    price_map = {}
    for _, sku, price in result:
        if price is not None:
            price_map[sku.id] = float(price)

    # Add price data to each SKU
    for sku in product.skus:
        sku.lowest_listing_price_total = price_map.get(sku.id)

    return product


@router.get("/search", response_model=ProductSearchResponseSchema)
def search_products(
    search_params: ProductSearchRequestParams = Depends(),
    session: Session = Depends(get_db_session),
):
    query_text = search_params.query
    catalog_id = search_params.catalog_id
    product_type = search_params.product_type
    set_id = search_params.set_id
    page = search_params.page
    limit = 10

    # Build search query (automatically joins Set, filters, and orders by rank)
    base_search_query = build_product_search_query(query_text)

    # Add catalog filter if provided
    if catalog_id:
        base_search_query = base_search_query.where(Set.catalog_id == catalog_id)

    # Add product type filter if provided
    if product_type:
        base_search_query = base_search_query.where(
            Product.product_type == product_type
        )

    # Add set filter if provided
    if set_id:
        base_search_query = base_search_query.where(Product.set_id == set_id)

    # Get total count for pagination metadata
    count_query = select(func.count()).select_from(base_search_query.subquery())
    total = session.scalar(count_query)

    # Calculate offset and apply pagination
    offset = (page - 1) * limit
    paginated_query = base_search_query.offset(offset).limit(limit)

    # Execute paginated query
    results = session.scalars(
        paginated_query.options(*ProductWithSetAndSKUsResponseSchema.get_load_options())
    ).all()

    # Calculate pagination metadata
    has_next = (page * limit) < total
    has_prev = page > 1

    return ProductSearchResponseSchema(
        results=results,
        total=total,
        page=page,
        limit=limit,
        has_next=has_next,
        has_prev=has_prev,
    )


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


@router.get("/sets", response_model=SetsResponseSchema)
def get_sets(session: Session = Depends(get_db_session)):
    """
    Endpoint to fetch all Pokemon sets with their display name and ID.
    """
    # Filter sets to only return Pokemon sets
    pokemon_catalog_id = "067820ab-e61f-7a87-8000-f9c5e424c0c0"
    sets = session.scalars(
        select(Set)
        .where(Set.catalog_id == pokemon_catalog_id)
        .order_by(Set.name)
    ).all()
    return SetsResponseSchema(sets=sets)


@router.get(
    "/product/{product_id}/market-data",
    response_model=MarketDataResponseSchema,
    summary="Get market data for all Near Mint/Unopened SKUs of a Product",
)
async def get_product_market_data(
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
    market_data = await market_data_service.get_market_data_for_product(
        session=session,
        product_id=product_id,
        sales_lookback_days=sales_lookback_days,
    )
    return MarketDataResponseSchema(**market_data)


@router.get(
    "/sku/{sku_id}/market-data",
    response_model=MarketDataResponseSchema,
    summary="Get market-depth data for a SKU variant",
)
async def get_sku_market_data(
    sku_id: uuid.UUID,
    sales_lookback_days: int = 30,
    session: Session = Depends(get_db_session),
):
    """
    Return market data for a specific SKU variant.
    Now calls the dedicated service function.
    """
    # Delegate to service which returns a MarketDataResponse-like dict
    market_data = await market_data_service.get_market_data_for_sku(
        session=session,
        sku_id=sku_id,
        sales_lookback_days=sales_lookback_days,
    )
    return MarketDataResponseSchema(**market_data)



