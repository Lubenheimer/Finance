import uuid
from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel
from app.schemas.category import CategoryResponse


class TransactionCreate(BaseModel):
    account_id: uuid.UUID
    booking_date: date
    value_date: date | None = None
    amount: Decimal
    currency: str = "EUR"
    counterparty: str | None = None
    purpose: str | None = None
    category_id: uuid.UUID | None = None
    notes: str | None = None
    is_transfer: bool = False


class TransactionUpdate(BaseModel):
    category_id: uuid.UUID | None = None
    notes: str | None = None
    is_transfer: bool | None = None


class TransactionResponse(BaseModel):
    id: uuid.UUID
    account_id: uuid.UUID
    booking_date: date
    value_date: date | None
    amount: Decimal
    currency: str
    counterparty: str | None
    purpose: str | None
    category_id: uuid.UUID | None
    category: CategoryResponse | None
    notes: str | None
    is_transfer: bool
    source: str
    imported_at: datetime

    model_config = {"from_attributes": True}
