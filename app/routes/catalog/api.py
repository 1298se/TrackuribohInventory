from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import Session, joinedload

from app.routes.catalog.schemas import (
    CatalogsResponseSchema,
    ProductSearchRequestParams,
    ProductWithSetAndSKUsResponseSchema,
    ProductSearchResponseSchema,
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

    results = session.scalars(
        base_search_query.options(*ProductWithSetAndSKUsResponseSchema.get_load_options()).limit(30)
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