"""merge_heads_for_is_draft_addition

Revision ID: 2a304ad65629
Revises: ebe681c33b3e
Create Date: 2025-03-30 13:37:35.154071

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2a304ad65629'
down_revision: Union[str, None] = 'ebe681c33b3e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
