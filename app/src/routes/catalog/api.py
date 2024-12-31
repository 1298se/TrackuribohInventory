from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from src.routes.catalog.schemas import ProductWithSKUsResponseSchema, ProductSearchResponseSchema
from core.database import get_db_session
from core.src.models import Product

router = APIRouter(
    prefix="/catalog",
)

@router.get("/product/{product_id}", response_model=ProductWithSKUsResponseSchema)
async def get_product(product_id: str, session: Session = Depends(get_db_session)):
    product = session.get(Product, product_id)

    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")

    return product

@router.get("/search", response_model=ProductSearchResponseSchema)
def search_products(query: str, session: Session = Depends(get_db_session)):
    word_similarity = func.word_similarity(query, Product.name)

    results = session.scalars(
        select(Product).where(word_similarity > 0.5).order_by(word_similarity.desc()).options(
            *ProductWithSKUsResponseSchema.get_load_options()
        )
    ).all()

    return ProductSearchResponseSchema(
        results=results
    )


