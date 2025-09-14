import uuid
from typing import List, TypedDict
from datetime import datetime
from decimal import Decimal

from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert

from core.models.decisions import BuyDecision, Decision


class BuyDecisionData(TypedDict):
    """Type definition for buy decision data used in insert_buy_decisions."""

    sku_id: uuid.UUID
    decision: Decision
    quantity: int
    buy_vwap: Decimal
    expected_resale_net: Decimal
    asof_listings: datetime
    asof_sales: datetime
    reason_codes: List[str]


def insert_buy_decisions(
    session: Session, decisions: List[BuyDecisionData]
) -> List[BuyDecision]:
    """
    Insert multiple buy decision records efficiently.

    Args:
        session: Database session
        decisions: List of BuyDecisionData dictionaries

    Returns:
        List of BuyDecision records that were inserted
    """
    if not decisions:
        return []

    stmt = insert(BuyDecision).values(decisions).returning(BuyDecision)

    result = session.execute(stmt)
    inserted_decisions: List[BuyDecision] = result.scalars().all()

    session.flush()

    return inserted_decisions
