import os
import sys
import re

# Add the project root to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.models.transaction import Platform, Transaction
from core.database import SessionLocal


def backfill_tcgplayer_order_ids():
    with SessionLocal() as session:
        # Ensure TCGPlayer platform exists
        tcgplayer = session.query(Platform).filter(Platform.name == "TCGPlayer").first()
        if not tcgplayer:
            tcgplayer = Platform(name="TCGPlayer")
            session.add(tcgplayer)
            session.commit()
            print(f"Created TCGPlayer platform with ID: {tcgplayer.id}")
        else:
            print(f"TCGPlayer platform already exists with ID: {tcgplayer.id}")

        # Regex to match comments and extract order id
        pattern = re.compile(r"^TCGPlayer order (?P<order_id>\S+)$")

        # Find transactions with matching comments
        transactions = (
            session.query(Transaction)
            .filter(Transaction.comment.like("TCGPlayer order %"))
            .all()
        )

        updated_count = 0
        for txn in transactions:
            if txn.comment and txn.platform_order_id is None:
                match = pattern.match(txn.comment.strip())
                if match:
                    order_id = match.group("order_id")
                    txn.platform_id = tcgplayer.id
                    txn.platform_order_id = order_id
                    updated_count += 1

        session.commit()
        print(
            f"Updated {updated_count} transactions with TCGPlayer platform and order IDs"
        )


if __name__ == "__main__":
    backfill_tcgplayer_order_ids()
