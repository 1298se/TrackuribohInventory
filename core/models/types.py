from dataclasses import dataclass
from decimal import Decimal
from typing import Annotated

# The argument 2 doesn't actually do anything, just need to be passed in for Annotated construct to be valid
MoneyAmount = Annotated[Decimal, 2]

@dataclass
class Money:
    amount: MoneyAmount
    currency: str
