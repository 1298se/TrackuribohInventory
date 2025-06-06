"""Add Platform model and relationship

Revision ID: be0a0c7ba16a
Revises: ebe681c33b3e
Create Date: 2025-04-05 18:32:22.974258

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from uuid_extensions import uuid7


# revision identifiers, used by Alembic.
revision: str = "be0a0c7ba16a"
down_revision: Union[str, None] = "ebe681c33b3e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table(
        "platform",
        sa.Column("id", sa.UUID(), nullable=False, default=uuid7),
        sa.Column("name", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.add_column("transaction", sa.Column("platform_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_transaction_platform_id", "transaction", "platform", ["platform_id"], ["id"]
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_constraint("fk_transaction_platform_id", "transaction", type_="foreignkey")
    op.drop_column("transaction", "platform_id")
    op.drop_table("platform")
    # ### end Alembic commands ###
