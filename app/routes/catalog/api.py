from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import Session, joinedload

from app.routes.catalog.schemas import (
    CatalogsResponseSchema,
    ProductSearchRequestParams,
    ProductWithSetAndSKUsResponseSchema,
    ProductSearchResponseSchema,
    ProductSearchResultSchema,
    ProductTypesResponseSchema,
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


@router.get("/product/{product_id}", response_model=ProductWithSetAndSKUsResponseSchema | None)
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
        return None

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

    # Build fuzzy search query with OR logic for typo tolerance
    # This makes search more forgiving and returns relevant results even with typos
    base_search_query = build_product_search_query(query_text, fuzzy=True)

    # Add catalog filter if provided
    if catalog_id:
        base_search_query = base_search_query.where(Set.catalog_id == catalog_id)

    # Add product type filter if provided
    if product_type:
        base_search_query = base_search_query.where(
            Product.product_type == product_type
        )

    # Use lightweight schema without SKUs for fast search results
    # SKUs will be loaded on-demand when user views product detail
    results = session.scalars(
        base_search_query.options(*ProductSearchResultSchema.get_load_options()).limit(20)
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