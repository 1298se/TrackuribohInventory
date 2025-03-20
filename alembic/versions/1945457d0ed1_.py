"""empty message

Revision ID: 1945457d0ed1
Revises: c75876a39c72
Create Date: 2025-03-20 00:59:05.134939

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1945457d0ed1'
down_revision: Union[str, None] = 'c75876a39c72'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
