import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from datetime import date, datetime
from decimal import Decimal

from app.db.models.account import Account
from app.db.models.transaction import Transaction
from app.db.session import get_db
from app.services.importers import PROFILES
from app.services.importers.base import ParsedTransaction

router = APIRouter(prefix="/import", tags=["import"])


class PreviewRow(BaseModel):
    booking_date: date
    value_date: date | None
    amount: Decimal
    currency: str
    counterparty: str
    purpose: str
    hash: str
    is_duplicate: bool
    is_soft_duplicate: bool = False  # same date+amount+account, different hash


class PreviewResponse(BaseModel):
    rows: list[PreviewRow]
    total: int
    duplicates: int
    soft_duplicates: int
    new: int


class ConfirmRequest(BaseModel):
    account_id: uuid.UUID
    profile: str
    rows: list[PreviewRow]


class ImportBatch(BaseModel):
    batch_id: uuid.UUID
    imported_at: datetime
    profile: str
    account_id: uuid.UUID
    account_name: str
    count: int

    model_config = {"from_attributes": True}


@router.post("/preview", response_model=PreviewResponse)
async def preview_import(
    file: UploadFile = File(...),
    account_id: uuid.UUID = Form(...),
    profile: str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    if profile not in PROFILES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unbekanntes Profil: {profile}. Erlaubt: {list(PROFILES)}")

    account = await db.get(Account, account_id)
    if not account:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Konto nicht gefunden")

    content = await file.read()
    try:
        parsed: list[ParsedTransaction] = PROFILES[profile].parse(content)
    except Exception as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Parse-Fehler: {e}")

    hashes = [p.compute_hash(account_id) for p in parsed]

    # ── Exact duplicate check (same hash) ────────────────────────────────────
    existing_hashes: set[str] = set()
    if hashes:
        result = await db.execute(
            select(Transaction.hash).where(Transaction.hash.in_(hashes))
        )
        existing_hashes = {row[0] for row in result.all()}

    # ── Soft duplicate check (same account + date + amount, different hash) ──
    # Build a set of (booking_date, amount) tuples from the incoming rows
    date_amount_pairs = {(p.booking_date, p.amount) for p in parsed}

    existing_soft: set[tuple] = set()
    if date_amount_pairs:
        from sqlalchemy import tuple_ as sql_tuple
        soft_result = await db.execute(
            select(Transaction.booking_date, Transaction.amount)
            .where(Transaction.account_id == account_id)
            .where(
                sql_tuple(Transaction.booking_date, Transaction.amount).in_(
                    list(date_amount_pairs)
                )
            )
        )
        existing_soft = {(row.booking_date, row.amount) for row in soft_result.all()}

    rows = []
    for p, h in zip(parsed, hashes):
        is_dup = h in existing_hashes
        is_soft = (
            not is_dup
            and (p.booking_date, p.amount) in existing_soft
        )
        rows.append(PreviewRow(
            booking_date=p.booking_date,
            value_date=p.value_date,
            amount=p.amount,
            currency=p.currency,
            counterparty=p.counterparty,
            purpose=p.purpose,
            hash=h,
            is_duplicate=is_dup,
            is_soft_duplicate=is_soft,
        ))

    exact_dup_count = sum(1 for r in rows if r.is_duplicate)
    soft_dup_count = sum(1 for r in rows if r.is_soft_duplicate)
    new_count = sum(1 for r in rows if not r.is_duplicate)
    return PreviewResponse(
        rows=rows,
        total=len(rows),
        duplicates=exact_dup_count,
        soft_duplicates=soft_dup_count,
        new=new_count,
    )


@router.post("/confirm", status_code=status.HTTP_201_CREATED)
async def confirm_import(body: ConfirmRequest, db: AsyncSession = Depends(get_db)):
    account = await db.get(Account, body.account_id)
    if not account:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Konto nicht gefunden")

    new_rows = [r for r in body.rows if not r.is_duplicate]
    if not new_rows:
        return {"imported": 0, "batch_id": None}

    batch_id = uuid.uuid4()

    for row in new_rows:
        tx = Transaction(
            account_id=body.account_id,
            booking_date=row.booking_date,
            value_date=row.value_date,
            amount=row.amount,
            currency=row.currency,
            counterparty=row.counterparty,
            purpose=row.purpose,
            hash=row.hash,
            source=f"csv:{body.profile}",
            batch_id=batch_id,
        )
        db.add(tx)

    await db.commit()
    return {"imported": len(new_rows), "batch_id": str(batch_id)}


# ── GET /import/history ───────────────────────────────────────────────────────

@router.get("/history", response_model=list[ImportBatch])
async def import_history(db: AsyncSession = Depends(get_db)):
    """Return one entry per distinct batch_id, newest first."""
    result = await db.execute(
        select(
            Transaction.batch_id,
            func.min(Transaction.imported_at).label("imported_at"),
            Transaction.source,
            Transaction.account_id,
            func.count(Transaction.id).label("count"),
        )
        .where(Transaction.batch_id.isnot(None))
        .group_by(Transaction.batch_id, Transaction.source, Transaction.account_id)
        .order_by(func.min(Transaction.imported_at).desc())
    )
    rows = result.all()

    # Load account names
    account_ids = {r.account_id for r in rows}
    accounts_result = await db.execute(select(Account).where(Account.id.in_(account_ids)))
    account_map = {a.id: a.name for a in accounts_result.scalars()}

    return [
        ImportBatch(
            batch_id=r.batch_id,
            imported_at=r.imported_at,
            profile=r.source.removeprefix("csv:") if r.source.startswith("csv:") else r.source,
            account_id=r.account_id,
            account_name=account_map.get(r.account_id, "–"),
            count=r.count,
        )
        for r in rows
    ]


# ── DELETE /import/batch/{batch_id} ──────────────────────────────────────────

@router.delete("/batch/{batch_id}", status_code=status.HTTP_200_OK)
async def delete_batch(batch_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Delete all transactions belonging to a batch."""
    result = await db.execute(
        delete(Transaction).where(Transaction.batch_id == batch_id)
    )
    await db.commit()
    return {"deleted": result.rowcount}
