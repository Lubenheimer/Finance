import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models.transaction import Transaction
from app.db.session import get_db
from app.schemas.transaction import TransactionCreate, TransactionResponse, TransactionUpdate

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("", response_model=list[TransactionResponse])
async def list_transactions(
    account_id: uuid.UUID | None = Query(None),
    search: str | None = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(Transaction)
        .options(selectinload(Transaction.category))
        .order_by(Transaction.booking_date.desc(), Transaction.imported_at.desc())
    )
    if account_id:
        q = q.where(Transaction.account_id == account_id)
    if search:
        term = f"%{search}%"
        q = q.where(
            Transaction.counterparty.ilike(term) | Transaction.purpose.ilike(term)
        )
    q = q.offset(offset).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/count")
async def count_transactions(
    account_id: uuid.UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    q = select(func.count()).select_from(Transaction)
    if account_id:
        q = q.where(Transaction.account_id == account_id)
    result = await db.execute(q)
    return {"count": result.scalar()}


@router.post("", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def create_transaction(body: TransactionCreate, db: AsyncSession = Depends(get_db)):
    tx = Transaction(**body.model_dump(), source="manual")
    db.add(tx)
    await db.commit()
    await db.refresh(tx)
    # reload with category
    result = await db.execute(
        select(Transaction).options(selectinload(Transaction.category)).where(Transaction.id == tx.id)
    )
    return result.scalar_one()


@router.patch("/{tx_id}", response_model=TransactionResponse)
async def update_transaction(tx_id: uuid.UUID, body: TransactionUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Transaction).options(selectinload(Transaction.category)).where(Transaction.id == tx_id)
    )
    tx = result.scalar_one_or_none()
    if not tx:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Transaction not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(tx, field, value)
    await db.commit()
    await db.refresh(tx)
    result = await db.execute(
        select(Transaction).options(selectinload(Transaction.category)).where(Transaction.id == tx_id)
    )
    return result.scalar_one()


@router.delete("/{tx_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(tx_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    tx = await db.get(Transaction, tx_id)
    if not tx:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Transaction not found")
    await db.delete(tx)
    await db.commit()
