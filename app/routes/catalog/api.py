from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.models.catalog import Product
from app.models.database import get_db_session
from app.routes.catalog.schemas import ProductWithSKUsResponseSchema

router = APIRouter(
    prefix="/catalog",
)

@router.get("/product/{product_id}", response_model=ProductWithSKUsResponseSchema)
async def get_product(product_id: str, session: Session = Depends(get_db_session)):
    product = session.get(Product, product_id)

    return product
