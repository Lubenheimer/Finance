import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy import DateTime, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100))
    type: Mapped[str] = mapped_column(String(20))        # giro|kreditkarte|depot|bargeld|sparbuch
    bank_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    iban: Mapped[str | None] = mapped_column(String(34), nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="EUR")
    color: Mapped[str | None] = mapped_column(String(20), nullable=True)
    balance_cached: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    balance_cached_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sync_method: Mapped[str] = mapped_column(String(20), default="manual")  # fints|csv|manual
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    transactions: Mapped[list["Transaction"]] = relationship("Transaction", back_populates="account")  # noqa: F821
