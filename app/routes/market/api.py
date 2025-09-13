from fastapi import APIRouter, Depends, HTTPException
from core.auth import get_current_user
from sqlalchemy import select
from sqlalchemy.orm import Session
import uuid

from app.routes.catalog.schemas import (
    CatalogsResponseSchema,
    ProductSearchRequestParams,
    ProductWithSetAndSKUsResponseSchema,
    ProductSearchResponseSchema,
    ProductTypesResponseSchema,
    MarketDataResponseSchema,
)
from core.database import get_db_session
from core.models.catalog import Product
from core.models.catalog import Catalog
from core.models.catalog import Set
from core.services.schemas.schema import ProductType
from core.dao.catalog import build_product_search_query
from core.services import market_data_service

router = APIRouter(
    prefix="/market",
)

# @klin testing
@router.get("/products", response_model=ProductSearchResponseSchema)
def get_products_list(session: Session = Depends(get_db_session)):
    products = session.scalars(
        select(Product)
        .join(Set)
        .join(Catalog)
        .where(Product.product_type == ProductType.CARDS)
        .where(Catalog.display_name == "Pokemon")
        .limit(1)
    ).all()
    
    return ProductSearchResponseSchema(results=products)


