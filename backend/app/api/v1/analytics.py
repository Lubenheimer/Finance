"""
Analytics endpoints for charts and reports.
"""
from decimal import Decimal
from fastapi import APIRouter, Depends, Query
from sqlalchemy import extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.transaction import Transaction
from app.db.models.category import Category
from app.db.session import get_db

router = APIRouter(prefix="/analytics", tags=["analytics"])


# ── GET /analytics/monthly ────────────────────────────────────────────────────

@router.get("/monthly")
async def monthly_summary(
    months: int = Query(12, ge=1, le=60),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns income, expenses and net per month for the last N months,
    ordered oldest → newest.
    """
    # income category IDs
    income_cats = await db.execute(
        select(Category.id).where(Category.kind == "income")
    )
    income_ids = {str(r) for (r,) in income_cats.all()}

    result = await db.execute(
        select(
            extract("year", Transaction.booking_date).label("year"),
            extract("month", Transaction.booking_date).label("month"),
            func.sum(Transaction.amount).label("total"),
            Transaction.category_id,
        )
        .group_by("year", "month", Transaction.category_id)
        .order_by("year", "month")
    )
    rows = result.all()

    # Aggregate into month buckets
    buckets: dict[str, dict] = {}
    for row in rows:
        key = f"{int(row.year)}-{int(row.month):02d}"
        if key not in buckets:
            buckets[key] = {"month": key, "income": Decimal(0), "expenses": Decimal(0)}
        val = Decimal(str(row.total or 0))
        if str(row.category_id) in income_ids:
            buckets[key]["income"] += val
        else:
            buckets[key]["expenses"] += val

    # Sort and take last N months
    sorted_months = sorted(buckets.values(), key=lambda x: x["month"])
    selected = sorted_months[-months:]

    return [
        {
            "month": b["month"],
            "income": float(b["income"]),
            "expenses": float(abs(b["expenses"])),
            "net": float(b["income"] + b["expenses"]),
        }
        for b in selected
    ]


# ── GET /analytics/categories ─────────────────────────────────────────────────

@router.get("/categories")
async def category_breakdown(
    month: str = Query(..., description="YYYY-MM"),
    kind: str = Query("expense", description="income or expense"),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns spending/income per category for a given month.
    """
    try:
        year, mon = int(month[:4]), int(month[5:7])
    except (ValueError, IndexError):
        return []

    # Get all categories of requested kind (including uncategorized bucket)
    cats_result = await db.execute(
        select(Category).where(Category.kind == kind)
    )
    cats = {str(c.id): c for c in cats_result.scalars()}

    result = await db.execute(
        select(
            Transaction.category_id,
            func.sum(Transaction.amount).label("total"),
        )
        .join(Category, Transaction.category_id == Category.id, isouter=True)
        .where(
            extract("year", Transaction.booking_date) == year,
            extract("month", Transaction.booking_date) == mon,
        )
        .group_by(Transaction.category_id)
    )
    rows = result.all()

    out = []
    uncategorized = Decimal(0)

    for cat_id, total in rows:
        val = Decimal(str(total or 0))
        if cat_id is None:
            uncategorized += val
            continue
        cat = cats.get(str(cat_id))
        if cat is None:
            continue
        # filter by kind
        if cat.kind != kind:
            continue
        out.append({
            "category_id": str(cat_id),
            "name": cat.name,
            "icon": cat.icon or "",
            "color": cat.color or "#6b7280",
            "amount": float(abs(val)),
        })

    # Sort by amount descending
    out.sort(key=lambda x: x["amount"], reverse=True)

    # Add uncategorized bucket if non-zero
    if abs(uncategorized) > Decimal("0.01"):
        out.append({
            "category_id": None,
            "name": "Unkategorisiert",
            "icon": "❓",
            "color": "#6b7280",
            "amount": float(abs(uncategorized)),
        })

    return out


# ── GET /analytics/top-counterparties ─────────────────────────────────────────

@router.get("/top-counterparties")
async def top_counterparties(
    month: str = Query(..., description="YYYY-MM"),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Top spending counterparties for a given month (expenses only)."""
    try:
        year, mon = int(month[:4]), int(month[5:7])
    except (ValueError, IndexError):
        return []

    result = await db.execute(
        select(
            Transaction.counterparty,
            func.sum(Transaction.amount).label("total"),
        )
        .where(
            extract("year", Transaction.booking_date) == year,
            extract("month", Transaction.booking_date) == mon,
            Transaction.amount < 0,
            Transaction.counterparty.isnot(None),
        )
        .group_by(Transaction.counterparty)
        .order_by(func.sum(Transaction.amount))
        .limit(limit)
    )

    return [
        {"counterparty": row.counterparty, "amount": float(abs(row.total))}
        for row in result.all()
        if row.counterparty
    ]
