import uuid
from decimal import Decimal
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.budget import Budget, BudgetItem
from app.db.models.transaction import Transaction
from app.db.models.category import Category
from app.db.session import get_db
from app.schemas.budget import BudgetItemCreate, BudgetItemUpdate, BudgetItemResponse, BudgetResponse

router = APIRouter(prefix="/budgets", tags=["budgets"])


async def _get_or_create_budget(month: str, db: AsyncSession) -> Budget:
    """Return existing budget for month or create a new empty one."""
    result = await db.execute(
        select(Budget)
        .where(Budget.month == month)
        .options(selectinload(Budget.items))
    )
    budget = result.scalar_one_or_none()
    if not budget:
        budget = Budget(month=month)
        db.add(budget)
        await db.commit()
        await db.refresh(budget, ["items"])
    return budget


async def _compute_actuals(month: str, db: AsyncSession) -> dict[str, Decimal]:
    """Sum transactions for the given month grouped by category + total income."""
    try:
        year, mon = int(month[:4]), int(month[5:7])
    except (ValueError, IndexError):
        return {}

    result = await db.execute(
        select(Transaction.category_id, func.sum(Transaction.amount))
        .where(
            extract("year", Transaction.booking_date) == year,
            extract("month", Transaction.booking_date) == mon,
        )
        .group_by(Transaction.category_id)
    )
    rows = result.all()

    actuals: dict[str, Decimal] = {}
    income_total = Decimal("0")

    # Fetch income-kind category ids once
    income_cats = await db.execute(
        select(Category.id).where(Category.kind == "income")
    )
    income_cat_ids = {str(r) for (r,) in income_cats.all()}

    for cat_id, total in rows:
        if total is None:
            continue
        if cat_id is None:
            continue
        key = str(cat_id)
        val = Decimal(str(total))
        actuals[key] = val
        if key in income_cat_ids:
            income_total += val

    actuals["income"] = income_total
    return actuals


# ── GET /budgets/{month} ──────────────────────────────────────────────────────

@router.get("/{month}", response_model=BudgetResponse)
async def get_budget(month: str, db: AsyncSession = Depends(get_db)):
    budget = await _get_or_create_budget(month, db)
    actuals = await _compute_actuals(month, db)
    return BudgetResponse(
        month=budget.month,
        items=[BudgetItemResponse.model_validate(i) for i in budget.items],
        actuals=actuals,
    )


# ── POST /budgets/{month}/items ───────────────────────────────────────────────

@router.post("/{month}/items", response_model=BudgetItemResponse, status_code=status.HTTP_201_CREATED)
async def create_budget_item(month: str, body: BudgetItemCreate, db: AsyncSession = Depends(get_db)):
    budget = await _get_or_create_budget(month, db)
    item = BudgetItem(budget_id=budget.id, **body.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


# ── PATCH /budgets/{month}/items/{item_id} ────────────────────────────────────

@router.patch("/{month}/items/{item_id}", response_model=BudgetItemResponse)
async def update_budget_item(
    month: str, item_id: uuid.UUID, body: BudgetItemUpdate, db: AsyncSession = Depends(get_db)
):
    item = await db.get(BudgetItem, item_id)
    if not item:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Item not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(item, field, value)
    await db.commit()
    await db.refresh(item)
    return item


# ── DELETE /budgets/{month}/items/{item_id} ───────────────────────────────────

@router.delete("/{month}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_budget_item(month: str, item_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    item = await db.get(BudgetItem, item_id)
    if not item:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Item not found")
    await db.delete(item)
    await db.commit()
