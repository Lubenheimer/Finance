import uuid
from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("categories.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(100))
    icon: Mapped[str | None] = mapped_column(String(10), nullable=True)
    color: Mapped[str | None] = mapped_column(String(20), nullable=True)
    kind: Mapped[str] = mapped_column(String(10), default="expense")  # income|expense|transfer
    position: Mapped[int] = mapped_column(Integer, default=0)

    parent: Mapped["Category | None"] = relationship("Category", remote_side="Category.id", foreign_keys=[parent_id])
    children: Mapped[list["Category"]] = relationship("Category", foreign_keys=[parent_id])
