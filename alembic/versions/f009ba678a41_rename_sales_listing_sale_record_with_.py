"""Rename sales_listing -> sale_record with index/constraint renames

Revision ID: f009ba678a41
Revises: cab2d0620b52
Create Date: 2025-09-16 01:05:18.672122

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f009ba678a41"
down_revision: Union[str, None] = "cab2d0620b52"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Non-destructive rename of table and related database objects
    op.rename_table("sales_listing", "sale_record")
    # Rename indexes
    op.execute("ALTER INDEX ix_sales_listing_date RENAME TO ix_sale_record_date")
    op.execute(
        "ALTER INDEX ix_sales_listing_sku_marketplace_date RENAME TO ix_sale_record_sku_marketplace_date"
    )
    op.execute(
        "ALTER INDEX ux_sales_listing_sku_mkt_date_price_ship_qty RENAME TO ux_sale_record_sku_mkt_date_price_ship_qty"
    )
    # Rename check constraint
    op.execute(
        "ALTER TABLE sale_record RENAME CONSTRAINT ck_sales_listing_price_gt_zero TO ck_sale_record_price_gt_zero"
    )


def downgrade() -> None:
    # Revert constraint rename
    op.execute(
        "ALTER TABLE sale_record RENAME CONSTRAINT ck_sale_record_price_gt_zero TO ck_sales_listing_price_gt_zero"
    )
    # Revert index renames
    op.execute("ALTER INDEX ix_sale_record_date RENAME TO ix_sales_listing_date")
    op.execute(
        "ALTER INDEX ix_sale_record_sku_marketplace_date RENAME TO ix_sales_listing_sku_marketplace_date"
    )
    op.execute(
        "ALTER INDEX ux_sale_record_sku_mkt_date_price_ship_qty RENAME TO ux_sales_listing_sku_mkt_date_price_ship_qty"
    )
    # Revert table rename
    op.rename_table("sale_record", "sales_listing")
