import uuid
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.src.models import SKU


def get_skus_by_id(session: Session, ids: list[uuid.UUID]) -> Sequence[SKU]:
    return session.scalars(select(SKU).where(SKU.id.in_(ids))).all()
