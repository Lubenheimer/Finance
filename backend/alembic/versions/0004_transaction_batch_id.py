"""add batch_id to transactions

Revision ID: 0004
Revises: 0003
Create Date: 2026-05-03
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("transactions", sa.Column("batch_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index("ix_transactions_batch_id", "transactions", ["batch_id"])


def downgrade() -> None:
    op.drop_index("ix_transactions_batch_id", "transactions")
    op.drop_column("transactions", "batch_id")
