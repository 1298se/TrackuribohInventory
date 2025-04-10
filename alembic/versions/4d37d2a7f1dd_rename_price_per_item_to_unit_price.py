"""empty message

Revision ID: 4d37d2a7f1dd
Revises: 5d83a4a07acb
Create Date: 2025-03-07 01:01:54.983244

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4d37d2a7f1dd'
down_revision: Union[str, None] = '5d83a4a07acb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.alter_column('line_item', 'price_per_item_amount', new_column_name='unit_price_amount')
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.alter_column('line_item', 'unit_price_amount', new_column_name='price_per_item_amount')
    # ### end Alembic commands ###
