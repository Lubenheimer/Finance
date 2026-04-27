import hashlib
import uuid
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal


@dataclass
class ParsedTransaction:
    booking_date: date
    amount: Decimal
    counterparty: str = ""
    purpose: str = ""
    value_date: date | None = None
    counterparty_iban: str = ""
    currency: str = "EUR"
    raw_text: str = ""

    def compute_hash(self, account_id: uuid.UUID) -> str:
        key = f"{account_id}|{self.booking_date}|{self.amount}|{self.counterparty}|{self.purpose}"
        return hashlib.sha256(key.encode()).hexdigest()
