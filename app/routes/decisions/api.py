from fastapi import APIRouter, Depends
from sqlalchemy import select, desc
from sqlalchemy.orm import Session, selectinload

from core.database import get_db_session
from core.models.decisions import BuyDecision, Decision
from app.routes.catalog.schemas import SKUWithProductResponseSchema
from .schemas import BuyDecisionsResponseSchema, BuyDecisionResponseSchema

router = APIRouter(prefix="/buy-decisions", tags=["buy-decisions"])


@router.get("/", response_model=BuyDecisionsResponseSchema)
async def get_buy_decisions(
    session: Session = Depends(get_db_session),
):
    """
    Get latest BUY decision per SKU, sorted by expected profit (highest first).
    Returns all current BUY recommendations across all SKUs.
    Public endpoint for monitoring algorithm performance.
    """
    # Use DISTINCT ON to get latest decision per SKU
    query = (
        select(BuyDecision)
        .options(
            selectinload(BuyDecision.sku).options(
                *SKUWithProductResponseSchema.get_load_options()
            )
        )
        .where(BuyDecision.decision == Decision.BUY)
        .order_by(
            BuyDecision.sku_id,
            desc(BuyDecision.created_at),
            desc(BuyDecision.expected_resale_net),
        )
        .distinct(BuyDecision.sku_id)
    )

    # Execute the DISTINCT ON query first to get latest per SKU
    latest_decisions = session.execute(query).scalars().all()

    # Sort by expected_resale_net
    latest_decisions.sort(key=lambda d: d.expected_resale_net, reverse=True)
    results = latest_decisions

    # Transform results using the schema
    decisions = [
        BuyDecisionResponseSchema.model_validate(decision) for decision in results
    ]

    return BuyDecisionsResponseSchema(
        decisions=decisions,
        total_count=len(decisions),
        filters_applied={
            "decision": "BUY",
            "latest_per_sku": True,
        },
    )
