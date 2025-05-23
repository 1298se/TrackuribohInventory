"""add covering index for sku price data snapshot

Revision ID: 811760d1d175
Revises: c856f91227cd
Create Date: 2025-05-23 01:10:41.313946

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "811760d1d175"
down_revision: Union[str, None] = "c856f91227cd"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_index(
        "ix_sku_price_snapshot_covering",
        "sku_price_data_snapshot",
        [
            "sku_id",
            sa.literal_column("snapshot_datetime DESC"),
            "lowest_listing_price_total",
        ],
        unique=False,
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index(
        "ix_sku_price_snapshot_covering", table_name="sku_price_data_snapshot"
    )
    # ### end Alembic commands ###
