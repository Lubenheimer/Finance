import uuid
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import extract, func, select, delete as sql_delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.budget import Budget, BudgetItem
from app.db.models.transaction import Transaction
from app.db.models.category import Category
from app.db.session import get_db
from app.schemas.budget import BudgetItemCreate, BudgetItemUpdate, BudgetItemResponse, BudgetResponse

router = APIRouter(prefix="/budgets", tags=["budgets"])

GLOBAL_KEY = "global"


async def _get_or_create_budget(month: str, db: AsyncSession) -> Budget:
    result = await db.execute(
        select(Budget).where(Budget.month == month).options(selectinload(Budget.items))
    )
    budget = result.scalar_one_or_none()
    if not budget:
        budget = Budget(month=month)
        db.add(budget)
        await db.commit()
        await db.refresh(budget, ["items"])
    return budget


async def _compute_actuals(month: str, db: AsyncSession) -> dict[str, Decimal]:
    """Sum transactions for a YYYY-MM month. Returns {} for 'global' or invalid strings."""
    if month == GLOBAL_KEY:
        return {}
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

    income_cats = await db.execute(select(Category.id).where(Category.kind == "income"))
    income_cat_ids = {str(r) for (r,) in income_cats.all()}

    for cat_id, total in rows:
        if total is None or cat_id is None:
            continue
        key = str(cat_id)
        val = Decimal(str(total))
        actuals[key] = val
        if key in income_cat_ids:
            income_total += val

    actuals["income"] = income_total
    return actuals


def _shift_month(month: str, offset: int) -> str:
    year, mon = int(month[:4]), int(month[5:7])
    mon += offset
    while mon > 12:
        mon -= 12
        year += 1
    return f"{year}-{mon:02d}"


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


# ── DELETE /budgets/{month} ───────────────────────────────────────────────────

@router.delete("/{month}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_budget(month: str, db: AsyncSession = Depends(get_db)):
    if month == GLOBAL_KEY:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Jahresplan kann hierüber nicht gelöscht werden")
    result = await db.execute(select(Budget).where(Budget.month == month))
    budget = result.scalar_one_or_none()
    if not budget:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Budget nicht gefunden")
    await db.delete(budget)  # cascade deletes items
    await db.commit()


# ── POST /budgets/{month}/copy ────────────────────────────────────────────────

class CopyRequest(BaseModel):
    months: int           # how many months to fill
    start_month: str | None = None  # required when source is "global"


class CopyResponse(BaseModel):
    copied_to: list[str]
    skipped: list[str]


async def _copy_items(source: Budget, target: Budget, db: AsyncSession) -> None:
    for src in source.items:
        db.add(BudgetItem(
            budget_id=target.id,
            label=src.label,
            kind=src.kind,
            amount=src.amount,
            category_id=src.category_id,
            position=src.position,
        ))


@router.post("/{month}/copy", response_model=CopyResponse)
async def copy_budget(month: str, body: CopyRequest, db: AsyncSession = Depends(get_db)):
    if body.months < 1 or body.months > 24:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "months must be 1–24")

    # For "global", a start_month is required
    if month == GLOBAL_KEY:
        if not body.start_month:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "start_month required for global budget")
        base_month = body.start_month
        offsets = range(0, body.months)   # start_month inclusive
    else:
        base_month = month
        offsets = range(1, body.months + 1)  # next N months

    source_result = await db.execute(
        select(Budget).where(Budget.month == month).options(selectinload(Budget.items))
    )
    source = source_result.scalar_one_or_none()
    if not source or not source.items:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Source budget has no items to copy")

    copied_to: list[str] = []
    skipped: list[str] = []

    for offset in offsets:
        target_month = _shift_month(base_month, offset) if month != GLOBAL_KEY else _shift_month(base_month, offset)
        if month == GLOBAL_KEY:
            target_month = _shift_month(body.start_month, offset)  # type: ignore[arg-type]

        existing = await db.execute(
            select(Budget).where(Budget.month == target_month).options(selectinload(Budget.items))
        )
        target = existing.scalar_one_or_none()

        if target and target.items:
            skipped.append(target_month)
            continue

        if not target:
            target = Budget(month=target_month)
            db.add(target)
            await db.flush()

        await _copy_items(source, target, db)
        await db.flush()
        copied_to.append(target_month)

    await db.commit()
    return CopyResponse(copied_to=copied_to, skipped=skipped)


# ── POST /budgets/global/apply/{month} ───────────────────────────────────────
# Force-overwrites a month with the global budget (replaces existing items)

@router.post("/global/apply/{month}", response_model=BudgetResponse)
async def apply_global_to_month(month: str, db: AsyncSession = Depends(get_db)):
    if month == GLOBAL_KEY:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot apply global to itself")

    # Load global
    global_result = await db.execute(
        select(Budget).where(Budget.month == GLOBAL_KEY).options(selectinload(Budget.items))
    )
    global_budget = global_result.scalar_one_or_none()
    if not global_budget or not global_budget.items:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Globales Budget hat noch keine Einträge")

    # Get or create target month budget
    target_result = await db.execute(
        select(Budget).where(Budget.month == month).options(selectinload(Budget.items))
    )
    target = target_result.scalar_one_or_none()

    if target:
        # Delete existing items
        await db.execute(sql_delete(BudgetItem).where(BudgetItem.budget_id == target.id))
        await db.flush()
    else:
        target = Budget(month=month)
        db.add(target)
        await db.flush()

    # Copy global items to target
    await _copy_items(global_budget, target, db)
    await db.flush()
    await db.commit()
    db.expire_all()  # clear session cache so next query hits DB fresh

    refreshed = await db.execute(
        select(Budget).where(Budget.month == month).options(selectinload(Budget.items))
    )
    budget = refreshed.scalar_one()
    actuals = await _compute_actuals(month, db)
    return BudgetResponse(
        month=budget.month,
        items=[BudgetItemResponse.model_validate(i) for i in budget.items],
        actuals=actuals,
    )
