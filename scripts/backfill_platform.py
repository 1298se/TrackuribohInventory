import os
import sys
import uuid

# Add the project root to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from core.models.transaction import Platform, Transaction
from core.database import SessionLocal

def backfill_platforms():
    # Use SessionLocal for database connection
    with SessionLocal() as session:
        # Create TCGPlayer platform if it doesn't exist
        tcgplayer = session.query(Platform).filter(Platform.name == 'TCGPlayer').first()
        if not tcgplayer:
            tcgplayer = Platform(name='TCGPlayer')
            session.add(tcgplayer)
            session.commit()
            print(f'Created TCGPlayer platform with ID: {tcgplayer.id}')
        else:
            print(f'TCGPlayer platform already exists with ID: {tcgplayer.id}')

        # Backfill TCGPlayer transactions
        tcg_transactions = session.query(Transaction).filter(
            Transaction.comment.like('TCGPlayer%'),
            Transaction.platform_id.is_(None)
        ).all()

        tcg_updated_count = 0
        for transaction in tcg_transactions:
            transaction.platform_id = tcgplayer.id
            tcg_updated_count += 1

        session.commit()
        print(f'Updated {tcg_updated_count} transactions with TCGPlayer platform')

if __name__ == "__main__":
    backfill_platforms() 