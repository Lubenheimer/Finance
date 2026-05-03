import uuid
from decimal import Decimal
from pydantic import BaseModel


class BudgetItemCreate(BaseModel):
    label: str
    kind: str           # income | expense
    amount: Decimal
    category_id: uuid.UUID | None = None
    position: int = 0


class BudgetItemUpdate(BaseModel):
    label: str | None = None
    amount: Decimal | None = None
    category_id: uuid.UUID | None = None
    position: int | None = None


class BudgetItemResponse(BaseModel):
    id: uuid.UUID
    label: str
    kind: str
    amount: Decimal
    category_id: uuid.UUID | None
    position: int

    model_config = {"from_attributes": True}


class BudgetResponse(BaseModel):
    month: str
    items: list[BudgetItemResponse]
    # actual spending per category_id (stringified UUID → amount)
    # and "income" key for total actual income
    actuals: dict[str, Decimal]

    model_config = {"from_attributes": True}
