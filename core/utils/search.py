from sqlalchemy import func, String, ColumnElement
from core.models.catalog import Product
from core.models.catalog import Set


def create_product_set_fts_vector() -> ColumnElement:
    """
    Creates a combined, weighted tsvector expression for Product and Set full-text search.
    Uses core.models.Product and core.models.Set directly.
    Handles potential None values for rarity and product number.

    Returns:
        A SQLAlchemy ColumnElement representing the combined tsvector.
    """
    # --- Define individual weighted TS vectors using imported classes ---

    # Product Name (Weight A)
    product_name_ts = func.setweight(func.to_tsvector("english", Product.name), "A")

    # Set Name (Weight B)
    set_name_ts = func.setweight(func.to_tsvector("english", Set.name), "B")

    # Product Rarity (Weight C) - Extracted from JSONB, handles None
    rarity_expression = func.jsonb_path_query_first(
        Product.data, '$ ? (@.name == "Rarity").value'
    ).cast(String)
    rarity_ts = func.setweight(
        func.to_tsvector("english", func.coalesce(rarity_expression, "")), "C"
    )

    # Product Number (Weight C) - Extracted from JSONB, handles None
    product_number_expression = func.jsonb_path_query_first(
        Product.data, '$ ? (@.name == "Number").value'
    ).cast(String)
    product_number_ts = func.setweight(
        func.to_tsvector("english", func.coalesce(product_number_expression, "")), "C"
    )

    # --- Combine base vectors ---
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
    search_terms = query_text.split()
    return func.plainto_tsquery("english", " & ".join(search_terms))
