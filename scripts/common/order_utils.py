"""
Common utilities for parsing order JSONs into TransactionData and LineItemData for import and reprocess scripts.
"""

import pytz
from datetime import datetime
from decimal import Decimal
from typing import List, Optional, Tuple, Dict, Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.models.catalog import Product, Condition, Printing, SKU
from core.models.transaction import TransactionType
from core.dao.transaction import TransactionData, LineItemData


def find_product_by_tcgplayer_id(
    session: Session, tcgplayer_id: str
) -> Optional[Product]:
    """Find a product by its TCGPlayer ID."""
    return session.scalar(
        select(Product).where(Product.tcgplayer_id == int(tcgplayer_id))
    )


def find_condition_by_name(
    session: Session,
    name: str,
    catalog_id: UUID,
) -> Optional[Condition]:
    """Find a condition by its name, scoped to a specific catalog."""
    normalized_name = " ".join(word.capitalize() for word in name.split())
    return session.scalar(
        select(Condition).where(
            Condition.name == normalized_name,
            Condition.catalog_id == catalog_id,
        )
    )


def find_printing_by_name(
    session: Session,
    name: str,
    catalog_id: UUID,
) -> Optional[Printing]:
    """Find a printing by its name, scoped to a specific catalog."""
    normalized_name = " ".join(word.capitalize() for word in name.split())
    return session.scalar(
        select(Printing).where(
            Printing.name == normalized_name,
            Printing.catalog_id == catalog_id,
        )
    )


def find_sku(
    session: Session, product: Product, condition: Condition, printing: Printing
) -> Optional[SKU]:
    """Find a SKU by product, condition, and printing."""
    return session.scalar(
        select(SKU).where(
            SKU.product_id == product.id,
            SKU.condition_id == condition.id,
            SKU.printing_id == printing.id,
        )
    )


def parse_purchase_order(
    session: Session, order: Dict[str, Any]
) -> Tuple[Optional[TransactionData], List[LineItemData]]:
    """Parse a purchase order dict into TransactionData and list of LineItemData."""
    # Skip canceled orders
    if order.get("shippingStatus", "").lower() == "canceled":
        return None, []

    # Parse the date with EST timezone
    naive_date = datetime.fromisoformat(order["orderedAt"])
    eastern = pytz.timezone("US/Eastern")
    transaction_date = eastern.localize(naive_date)

    shipping_cost = Decimal(str(order.get("shippingAmount", 0)))
    tax_amount = Decimal(str(order.get("taxAmount", 0)))
    products = order.get("products", [])
    currency = products[0].get("currency", "USD") if products else "USD"
    vendor_id = order.get("vendorId", "")
    seller_name = (
        products[0].get("seller", "Unknown Seller") if products else "Unknown Seller"
    )

    transaction_data = TransactionData(
        date=transaction_date,
        type=TransactionType.PURCHASE,
        counterparty_name=seller_name,
        comment=f"TCGPlayer order {vendor_id}",
        currency=currency,
        shipping_cost_amount=shipping_cost,
        tax_amount=tax_amount,
    )

    line_items_data: List[LineItemData] = []
    for product_data in products:
        product_tcgplayer_id = product_data.get("vendorId")
        if not product_tcgplayer_id:
            continue
        product = find_product_by_tcgplayer_id(session, product_tcgplayer_id)
        if not product:
            continue
        condition_name = product_data.get("condition")
        if not condition_name:
            continue
        condition = find_condition_by_name(
            session, condition_name, product.set.catalog_id
        )
        if not condition:
            continue
        printing_name = product_data.get("finish")
        if not printing_name:
            continue
        printing = find_printing_by_name(session, printing_name, product.set.catalog_id)
        if not printing:
            continue
        sku = find_sku(session, product, condition, printing)
        if not sku:
            continue
        quantity = int(product_data.get("quantity", 0))
        unit_price = Decimal(str(product_data.get("price", 0)))
        line_items_data.append(
            LineItemData(
                sku_id=sku.id,
                quantity=quantity,
                unit_price_amount=unit_price,
            )
        )

    return transaction_data, line_items_data


def parse_sales_order(
    session: Session, order: Dict[str, Any]
) -> Tuple[Dict[str, Any], List[LineItemData]]:
    """Parse a sales order dict into kwargs for TransactionCreateRequestSchema and return line items with unit prices."""
    # Parse the date with EST timezone
    naive_date = datetime.fromisoformat(order["orderedAt"])
    eastern = pytz.timezone("US/Eastern")
    transaction_date = eastern.localize(naive_date)

    # Determine type
    tx_type = TransactionType.SALE
    # Counterparty = buyer
    products = order.get("products", [])
    counterparty_name = products[0].get("party", "Unknown") if products else "Unknown"
    # Financials
    shipping_cost = Decimal(str(order.get("shippingAmount", 0)))
    tax_amount = Decimal(str(order.get("taxAmount", 0)))
    # Line items total price
    items_total = sum(
        Decimal(str(p.get("price", 0))) * int(p.get("quantity", 0)) for p in products
    )
    # Subtotal = total line items price + shipping cost - tax amount
    subtotal = items_total + shipping_cost - tax_amount
    currency = products[0].get("currency", "USD") if products else "USD"
    platform_order_id = order.get("vendorId")
    # Build line_items list for schema and detailed line items with price
    line_items: List[Dict[str, Any]] = []
    line_items_data: List[LineItemData] = []
    for product_data in products:
        product_tcgplayer_id = product_data.get("vendorId")
        if not product_tcgplayer_id:
            continue
        product = find_product_by_tcgplayer_id(session, product_tcgplayer_id)
        if not product:
            continue
        # Look up condition and printing scoped to the product's catalog
        raw_condition = product_data.get("condition")
        condition = None
        if raw_condition:
            condition = find_condition_by_name(
                session,
                raw_condition,
                product.set.catalog_id,
            )
        raw_printing = product_data.get("finish")
        printing = None
        if raw_printing:
            printing = find_printing_by_name(
                session,
                raw_printing,
                product.set.catalog_id,
            )
        # Try exact match
        sku = None
        if condition and printing:
            sku = find_sku(session, product, condition, printing)
        # Fallback: by printing only
        if not sku and printing:
            sku = session.scalar(
                select(SKU)
                .where(SKU.product_id == product.id, SKU.printing_id == printing.id)
                .limit(1)
            )
        # Fallback: any SKU for product
        if not sku:
            sku = session.scalar(
                select(SKU).where(SKU.product_id == product.id).limit(1)
            )
        if not sku:
            continue
        # Build line item
        quantity = int(product_data.get("quantity", 0))
        price = Decimal(str(product_data.get("price", 0)))
        line_items.append({"sku_id": sku.id, "quantity": quantity})
        line_items_data.append(
            LineItemData(
                sku_id=sku.id,
                quantity=quantity,
                unit_price_amount=price,
            )
        )

    sale_kwargs = {
        "date": transaction_date,
        "type": tx_type,
        "counterparty_name": counterparty_name,
        "comment": None,
        "line_items": line_items,
        "currency": currency,
        "platform_id": None,
        "platform_order_id": platform_order_id,
        "shipping_cost_amount": shipping_cost,
        "subtotal_amount": subtotal,
        "tax_amount": tax_amount,
    }
    return sale_kwargs, line_items_data
