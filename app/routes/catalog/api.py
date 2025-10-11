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
    # Fetch product with set and SKUs (without prices)
    product = session.scalars(
        select(Product)
        .where(Product.id == product_id)
        .options(*ProductWithSetAndSKUsResponseSchema.get_load_options())
    ).first()

    if not product:
        return None

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
    limit = search_params.limit

    # Build fuzzy search query with OR logic for typo tolerance
    # This makes search more forgiving and returns relevant results even with typos
    base_search_query = build_product_search_query(query_text, fuzzy=True)

    # Add catalog filter if provided
    if catalog_id:
        base_search_query = base_search_query.where(Set.catalog_id == catalog_id)

    # Add set filter if provided
    if set_id:
        base_search_query = base_search_query.where(Set.id == set_id)

    # Add product type filter if provided
    if product_type:
        base_search_query = base_search_query.where(
            Product.product_type == product_type
        )

    # Filter out Code Cards
    base_search_query = base_search_query.where(
        (Product.rarity != "Code Card") | (Product.rarity.is_(None))
    )

    # Apply limit if provided
    if limit:
        base_search_query = base_search_query.limit(limit)

    # Use lightweight schema without SKUs for fast search results
    # SKUs will be loaded on-demand when user views product detail
    results = session.scalars(
        base_search_query.options(*ProductSearchResultSchema.get_load_options())
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