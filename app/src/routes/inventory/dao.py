from sqlalchemy import func, case, literal, select, Select
from sqlalchemy.orm import Session

from core.src.models import SKU
from core.src.models.inventory import Transaction, TransactionType, LineItem


def query_inventory_items(session: Session) -> Select:
    total_quantity = func.sum(
        case(
            (Transaction.type == TransactionType.PURCHASE, LineItem.quantity),
            (Transaction.type == TransactionType.SALE, -LineItem.quantity),
            else_=literal(0)
        )
    ).label('total_quantity')

    inventory_sku_quantity_cte = (
        select(
            LineItem.sku_id,
            total_quantity,
        )
        .join(Transaction)
        .group_by(LineItem.sku_id)
        .having(total_quantity > 0)
    ).cte()

    query = select(SKU, inventory_sku_quantity_cte.c.total_quantity).join(inventory_sku_quantity_cte, SKU.id == inventory_sku_quantity_cte.c.sku_id)

    return query
