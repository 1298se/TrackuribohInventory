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

    # Use PostgreSQL full text search on Product.name
    ts_vector = func.to_tsvector('english', Product.name)
    ts_query = func.plainto_tsquery('english', query_text)
    
    # Compute rank based on the search relevance
    rank = func.ts_rank(ts_vector, ts_query)
    
    filters = [ts_vector.op('@@')(ts_query)]
    
    base_search_query = select(Product).where(*filters).order_by(rank.desc())
    
    if catalog_id:
        # Join the Set table to filter by catalog_id
        base_search_query = (
            base_search_query
            .join(Set, Product.set_id == Set.id)
            .where(Set.catalog_id == catalog_id)
        )
    
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



