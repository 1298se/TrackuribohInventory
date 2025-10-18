"""Move ebay_product_id from product to product_variant.

Revision ID: e4e9a26ad6ac
Revises: cd4fb2cee067
Create Date: 2025-10-12 02:30:00.000000
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e4e9a26ad6ac"
down_revision: Union[str, None] = "cd4fb2cee067"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_product_variant_ebay_product_id;")
    op.execute("DROP INDEX IF EXISTS ix_product_ebay_product_id;")
    op.execute("ALTER TABLE product DROP COLUMN IF EXISTS ebay_product_id;")
    op.execute(
        "ALTER TABLE product_variant ADD COLUMN IF NOT EXISTS ebay_product_id VARCHAR;"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_product_variant_ebay_product_id "
        "ON product_variant (ebay_product_id);"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE product_variant DROP COLUMN IF EXISTS ebay_product_id;")
    op.execute("ALTER TABLE product ADD COLUMN IF NOT EXISTS ebay_product_id VARCHAR;")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_product_ebay_product_id "
        "ON product (ebay_product_id);"
    )
    op.execute("DROP INDEX IF EXISTS ix_product_variant_ebay_product_id;")
