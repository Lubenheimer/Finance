"""budgets and budget_items

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-03
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "budgets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("month", sa.String(7), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_budgets_month", "budgets", ["month"])

    op.create_table(
        "budget_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("budget_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("budgets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("label", sa.String(100), nullable=False),
        sa.Column("kind", sa.String(10), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("category_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("categories.id"), nullable=True),
        sa.Column("position", sa.Integer, nullable=False, server_default="0"),
    )
    op.create_index("ix_budget_items_budget_id", "budget_items", ["budget_id"])


def downgrade() -> None:
    op.drop_table("budget_items")
    op.drop_table("budgets")
