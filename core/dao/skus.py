import uuid
from sqlalchemy import Sequence, select
from sqlalchemy.orm import Session

from core.models.catalog import SKU


def get_skus_by_id(session: Session, ids: list[uuid.UUID]) -> Sequence[SKU]:
    return session.scalars(select(SKU).where(SKU.id.in_(ids))).all()