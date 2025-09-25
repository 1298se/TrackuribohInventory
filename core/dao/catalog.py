import uuid
from typing import List
from sqlalchemy import func, String, select, Sequence
from sqlalchemy.orm import Session
from sqlalchemy.sql import ColumnElement
from core.models.catalog import Product, Set, SKU
from core.services.sku_selection import ProcessingSKU


def create_product_set_fts_vector() -> ColumnElement:
    """
    Creates a combined, weighted tsvector expression for Product and Set full-text search.
    Uses core.models.Product and core.models.Set directly.
    Handles potential None values for rarity and product number.
    Returns:
        A SQLAlchemy ColumnElement representing the combined tsvector.
    """
    product_name_ts = func.setweight(func.to_tsvector("english", Product.name), "A")
    set_name_ts = func.setweight(func.to_tsvector("english", Set.name), "B")
    rarity_expr = func.jsonb_path_query_first(
        Product.data, '$ ? (@.name == "Rarity").value'
    ).cast(String)
    rarity_ts = func.setweight(
        func.to_tsvector("english", func.coalesce(rarity_expr, "")), "C"
    )
    product_number_expr = func.jsonb_path_query_first(
        Product.data, '$ ? (@.name == "Number").value'
    ).cast(String)
    product_number_ts = func.setweight(
        func.to_tsvector("english", func.coalesce(product_number_expr, "")), "C"
    )
    combined_vector = (
        product_name_ts.op("||")(set_name_ts)
        .op("||")(rarity_ts)
        .op("||")(product_number_ts)
    )
    return combined_vector


def create_ts_query(query_text: str) -> ColumnElement:
    """
    Creates a tsquery function from a raw query string.
    Splits the query text and joins with ' & ' for plainto_tsquery.
    """
    terms = query_text.split()
    return func.plainto_tsquery("english", " & ".join(terms))


def build_product_search_query(query_text: str, prefix: bool = False):
    """
    Builds a complete SQLAlchemy select for Product text search,
    including the join to Set, a filter by full-text match,
    and ordering by relevance rank.
    """
    stmt = select(Product).join(Product.set)
    
    # Only apply text search if we have a meaningful query
    if query_text and query_text.strip() and query_text != "*":
        if prefix and query_text:
            prefix_terms = [term + ":*" for term in query_text.split()]
            ts_query = func.to_tsquery("english", " & ".join(prefix_terms))
        else:
            ts_query = create_ts_query(query_text)

        # Use the persisted search_vector column for faster full-text search
        vector = Product.search_vector
        stmt = stmt.where(vector.op("@@")(ts_query)).order_by(func.ts_rank(vector, ts_query).desc())
    else:
        # When no meaningful query, just order by product name
        stmt = stmt.order_by(Product.name)
    
    return stmt


def get_skus_by_id(session: Session, ids: list[uuid.UUID]) -> Sequence[SKU]:
    return session.scalars(select(SKU).where(SKU.id.in_(ids))).all()


def get_all_skus_by_product_ids(
    session: Session, product_tcgplayer_ids: List[int]
) -> List[ProcessingSKU]:
    """
    Query all SKUs for the given product TCGPlayer IDs.

    Args:
        session: Database session
        product_tcgplayer_ids: List of TCGPlayer product IDs

    Returns:
        List of ProcessingSKU objects for all SKUs of those products
    """
    query = (
        select(
            SKU.id.label("sku_id"),
            Product.tcgplayer_id.label("product_tcgplayer_id"),
            Set.catalog_id,
            SKU.condition_id,
            SKU.printing_id,
            SKU.language_id,
            SKU.tcgplayer_id.label("sku_tcgplayer_id"),
        )
        .join(Product, Product.id == SKU.product_id)
        .join(Set, Set.id == Product.set_id)
        .where(Product.tcgplayer_id.in_(product_tcgplayer_ids))
    )

    results = session.execute(query).all()

    processing_skus = []
    for row in results:
        processing_sku = ProcessingSKU(
            sku_id=row.sku_id,
            product_tcgplayer_id=row.product_tcgplayer_id,
            catalog_id=row.catalog_id,
            condition_id=row.condition_id,
            printing_id=row.printing_id,
            language_id=row.language_id,
            sku_tcgplayer_id=int(row.sku_tcgplayer_id),
        )
        processing_skus.append(processing_sku)

    return processing_skus
