from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user
from app.auth.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    is_valid_token,
    verify_password,
)
from app.config import settings
from app.db.models.household import Household
from app.db.models.user import User
from app.db.session import get_db
from app.schemas.auth import LoginRequest, RegisterRequest, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])

_COOKIE_OPTS = {
    "httponly": True,
    "samesite": "strict",
    "secure": False,  # set True behind HTTPS in prod
}


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, response: Response, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")

    household = Household(name=body.household_name)
    db.add(household)
    await db.flush()

    user = User(
        household_id=household.id,
        email=body.email,
        password_hash=hash_password(body.password),
        name=body.name,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    _set_tokens(response, str(user.id))
    return user


@router.post("/login", response_model=UserResponse)
async def login(body: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")

    _set_tokens(response, str(user.id))
    return user


@router.post("/refresh", response_model=UserResponse)
async def refresh(response: Response, refresh_token: str | None = None, db: AsyncSession = Depends(get_db)):
    from fastapi import Cookie as FCookie

    raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, "Use the cookie-based refresh endpoint")


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return {"ok": True}


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


def _set_tokens(response: Response, user_id: str) -> None:
    response.set_cookie(
        "access_token",
        create_access_token(user_id),
        max_age=settings.access_token_expire_minutes * 60,
        **_COOKIE_OPTS,
    )
    response.set_cookie(
        "refresh_token",
        create_refresh_token(user_id),
        max_age=settings.refresh_token_expire_days * 86400,
        **_COOKIE_OPTS,
    )
