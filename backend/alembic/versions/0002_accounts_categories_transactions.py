"""accounts, categories, transactions

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-27
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "categories",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("categories.id"), nullable=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("icon", sa.String(10), nullable=True),
        sa.Column("color", sa.String(20), nullable=True),
        sa.Column("kind", sa.String(10), nullable=False, server_default="expense"),
        sa.Column("position", sa.Integer, nullable=False, server_default="0"),
    )

    op.create_table(
        "accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("bank_name", sa.String(100), nullable=True),
        sa.Column("iban", sa.String(34), nullable=True),
        sa.Column("currency", sa.String(3), nullable=False, server_default="EUR"),
        sa.Column("color", sa.String(20), nullable=True),
        sa.Column("balance_cached", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("balance_cached_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sync_method", sa.String(20), nullable=False, server_default="manual"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "transactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("accounts.id"), nullable=False),
        sa.Column("booking_date", sa.Date, nullable=False),
        sa.Column("value_date", sa.Date, nullable=True),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="EUR"),
        sa.Column("counterparty", sa.String(255), nullable=True),
        sa.Column("counterparty_iban", sa.String(34), nullable=True),
        sa.Column("purpose", sa.Text, nullable=True),
        sa.Column("raw_text", sa.Text, nullable=True),
        sa.Column("hash", sa.String(64), nullable=True, unique=True),
        sa.Column("category_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("categories.id"), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("is_transfer", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("source", sa.String(30), nullable=False, server_default="manual"),
        sa.Column("imported_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_transactions_account_id", "transactions", ["account_id"])
    op.create_index("ix_transactions_booking_date", "transactions", ["booking_date"])
    op.create_index("ix_transactions_hash", "transactions", ["hash"])

    # Default categories
    op.execute("""
        INSERT INTO categories (id, name, icon, color, kind, position) VALUES
        (gen_random_uuid(), 'Einkommen', '💰', '#22c55e', 'income', 0),
        (gen_random_uuid(), 'Wohnen', '🏠', '#3b82f6', 'expense', 1),
        (gen_random_uuid(), 'Lebensmittel', '🛒', '#f59e0b', 'expense', 2),
        (gen_random_uuid(), 'Mobilität', '🚗', '#8b5cf6', 'expense', 3),
        (gen_random_uuid(), 'Gesundheit', '❤️', '#ef4444', 'expense', 4),
        (gen_random_uuid(), 'Freizeit', '🎮', '#06b6d4', 'expense', 5),
        (gen_random_uuid(), 'Abos & Streaming', '📺', '#ec4899', 'expense', 6),
        (gen_random_uuid(), 'Versicherungen', '🛡️', '#64748b', 'expense', 7),
        (gen_random_uuid(), 'Sparen & Anlage', '📈', '#10b981', 'expense', 8),
        (gen_random_uuid(), 'Sonstiges', '📦', '#6b7280', 'expense', 9),
        (gen_random_uuid(), 'Interne Umbuchung', '↔️', '#94a3b8', 'transfer', 10)
    """)


def downgrade() -> None:
    op.drop_table("transactions")
    op.drop_table("accounts")
    op.drop_table("categories")
