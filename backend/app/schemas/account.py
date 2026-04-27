import uuid
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel


class AccountCreate(BaseModel):
    name: str
    type: str
    bank_name: str | None = None
    iban: str | None = None
    currency: str = "EUR"
    color: str | None = None
    sync_method: str = "manual"


class AccountUpdate(BaseModel):
    name: str | None = None
    bank_name: str | None = None
    iban: str | None = None
    color: str | None = None
    balance_cached: Decimal | None = None


class AccountResponse(BaseModel):
    id: uuid.UUID
    name: str
    type: str
    bank_name: str | None
    iban: str | None
    currency: str
    color: str | None
    balance_cached: Decimal
    sync_method: str
    created_at: datetime
    archived_at: datetime | None

    model_config = {"from_attributes": True}
