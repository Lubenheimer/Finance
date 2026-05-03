import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class Budget(Base):
    __tablename__ = "budgets"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    month: Mapped[str] = mapped_column(String(7), unique=True, index=True)  # YYYY-MM
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    items: Mapped[list["BudgetItem"]] = relationship(
        "BudgetItem", back_populates="budget",
        cascade="all, delete-orphan",
        order_by="BudgetItem.position",
    )


class BudgetItem(Base):
    __tablename__ = "budget_items"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    budget_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("budgets.id"), index=True)
    label: Mapped[str] = mapped_column(String(100))
    kind: Mapped[str] = mapped_column(String(10))       # income | expense
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    category_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("categories.id"), nullable=True)
    position: Mapped[int] = mapped_column(Integer, default=0)

    budget: Mapped["Budget"] = relationship("Budget", back_populates="items")
    category: Mapped["Category | None"] = relationship("Category")  # noqa: F821
