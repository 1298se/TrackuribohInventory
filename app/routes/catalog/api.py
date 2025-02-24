from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, join, select, func, literal_column
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID
from pydantic import BaseModel

from app.routes.catalog.schemas import CatalogsResponseSchema, ProductSearchRequestParams, ProductWithSetAndSKUsResponseSchema, ProductSearchResponseSchema, ProductTypesResponseSchema
from core.database import get_db_session
from core.models import Product, Catalog, Set
from core.services.schemas.schema import ProductType

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
    session: Session = Depends(get_db_session)
):
    query_text = search_params.query
    catalog_id = search_params.catalog_id

    # Split the search query into terms
    search_terms = query_text.split()

    # Define weighted TS vectors
    product_ts_vector_weighted = func.setweight(func.to_tsvector('english', Product.name), 'A')
    set_ts_vector_weighted = func.setweight(func.to_tsvector('english', Set.name), 'B')
    rarity_ts_vector_weighted = func.setweight(func.to_tsvector('english', Product.rarity), 'B')
    combined_ts_vector_weighted = product_ts_vector_weighted.op('||')(set_ts_vector_weighted).op('||')(rarity_ts_vector_weighted)

    # Create TS query
    ts_query = func.plainto_tsquery('english', ' & '.join(search_terms))

    # Define combined rank
    combined_rank = func.ts_rank(combined_ts_vector_weighted, ts_query)

    # Build search query
    base_search_query = (
        select(Product)
        .join(Set, Product.set_id == Set.id)
        .where(combined_ts_vector_weighted.op('@@')(ts_query))
        .order_by(combined_rank.desc())
    )

    # Apply catalog_id filter if provided
    if catalog_id:
        base_search_query = base_search_query.where(Set.catalog_id == catalog_id)

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
    
    return CatalogsResponseSchema(
        catalogs=catalogs
    )

@router.get("/product-types", response_model=ProductTypesResponseSchema)
def get_product_types(session: Session = Depends(get_db_session)):
    # Assuming ProductType is an Enum, return its values.
    return ProductTypesResponseSchema(product_types=list(ProductType))



