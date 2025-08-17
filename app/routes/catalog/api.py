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
    prefix="/catalog",
    dependencies=[Depends(get_current_user)],  # All routes require authentication
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
