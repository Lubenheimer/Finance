import uuid
from datetime import datetime, UTC
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models.account import Account
from app.db.session import get_db
from app.schemas.account import AccountCreate, AccountResponse, AccountUpdate

router = APIRouter(prefix="/accounts", tags=["accounts"])


@router.get("", response_model=list[AccountResponse])
async def list_accounts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Account).where(Account.archived_at.is_(None)).order_by(Account.created_at)
    )
    return result.scalars().all()


@router.post("", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
async def create_account(body: AccountCreate, db: AsyncSession = Depends(get_db)):
    account = Account(**body.model_dump())
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


@router.get("/{account_id}", response_model=AccountResponse)
async def get_account(account_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    account = await db.get(Account, account_id)
    if not account:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Account not found")
    return account


@router.patch("/{account_id}", response_model=AccountResponse)
async def update_account(account_id: uuid.UUID, body: AccountUpdate, db: AsyncSession = Depends(get_db)):
    account = await db.get(Account, account_id)
    if not account:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Account not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(account, field, value)
    await db.commit()
    await db.refresh(account)
    return account


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def archive_account(account_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    account = await db.get(Account, account_id)
    if not account:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Account not found")
    account.archived_at = datetime.now(UTC)
    await db.commit()
