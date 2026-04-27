import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from datetime import date
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


class PreviewResponse(BaseModel):
    rows: list[PreviewRow]
    total: int
    duplicates: int
    new: int


class ConfirmRequest(BaseModel):
    account_id: uuid.UUID
    profile: str
    rows: list[PreviewRow]


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

    # Bulk dedup check
    existing = set()
    if hashes:
        result = await db.execute(
            select(Transaction.hash).where(Transaction.hash.in_(hashes))
        )
        existing = {row[0] for row in result.all()}

    rows = []
    for p, h in zip(parsed, hashes):
        rows.append(PreviewRow(
            booking_date=p.booking_date,
            value_date=p.value_date,
            amount=p.amount,
            currency=p.currency,
            counterparty=p.counterparty,
            purpose=p.purpose,
            hash=h,
            is_duplicate=h in existing,
        ))

    new_count = sum(1 for r in rows if not r.is_duplicate)
    return PreviewResponse(
        rows=rows,
        total=len(rows),
        duplicates=len(rows) - new_count,
        new=new_count,
    )


@router.post("/confirm", status_code=status.HTTP_201_CREATED)
async def confirm_import(body: ConfirmRequest, db: AsyncSession = Depends(get_db)):
    account = await db.get(Account, body.account_id)
    if not account:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Konto nicht gefunden")

    new_rows = [r for r in body.rows if not r.is_duplicate]
    if not new_rows:
        return {"imported": 0}

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
        )
        db.add(tx)

    await db.commit()
    return {"imported": len(new_rows)}
