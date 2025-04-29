from sqlalchemy import func, String, select
from sqlalchemy.sql import ColumnElement
from core.models.catalog import Product, Set


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
    if prefix and query_text:
        prefix_terms = [term + ":*" for term in query_text.split()]
        ts_query = func.to_tsquery("english", " & ".join(prefix_terms))
    else:
        ts_query = create_ts_query(query_text)

    vector = create_product_set_fts_vector()
    stmt = (
        select(Product)
        .join(Product.set)
        .where(vector.op("@@")(ts_query))
        .order_by(func.ts_rank(vector, ts_query).desc())
    )
    return stmt
