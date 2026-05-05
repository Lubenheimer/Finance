"""
AI-based transaction categorizer using Claude.
Sends uncategorized transactions in a single batch to Claude,
which returns a category mapping based on the available categories.
"""
import json
import logging
from anthropic import AsyncAnthropic
from app.config import settings

logger = logging.getLogger(__name__)


async def auto_categorize(
    transactions: list[dict],  # [{"id": str, "counterparty": str, "purpose": str, "amount": str}]
    categories: list[dict],    # [{"id": str, "name": str, "kind": str, "parent_name": str|None}]
) -> dict[str, str]:
    """
    Returns a mapping of transaction_id → category_id.
    Skips transactions that don't fit any category (not included in result).
    """
    if not transactions or not categories:
        return {}

    if not settings.anthropic_api_key:
        logger.warning("ANTHROPIC_API_KEY not set — skipping auto-categorization")
        return {}

    client = AsyncAnthropic(api_key=settings.anthropic_api_key)

    # Build a compact category list for the prompt
    cat_lines = []
    for c in categories:
        label = c["name"]
        if c.get("parent_name"):
            label = f"{c['parent_name']} > {c['name']}"
        cat_lines.append(f'  {{"id": "{c["id"]}", "label": "{label}", "kind": "{c["kind"]}"}}')

    # Build compact transaction list
    tx_lines = []
    for t in transactions:
        amount = float(t["amount"])
        direction = "+" if amount >= 0 else "-"
        tx_lines.append(
            f'  {{"id": "{t["id"]}", "counterparty": "{t["counterparty"]}", '
            f'"purpose": "{t["purpose"][:80]}", "amount": "{direction}{abs(amount):.2f}"}}'
        )

    prompt = f"""You are categorizing German bank transactions.
Assign each transaction to the best matching category from the list below.
Only assign a category if you are reasonably confident. If unsure, omit the transaction.
Negative amounts are expenses, positive amounts are income.

CATEGORIES:
[
{chr(10).join(cat_lines)}
]

TRANSACTIONS:
[
{chr(10).join(tx_lines)}
]

Respond with ONLY a JSON object mapping transaction id to category id, like:
{{"<tx_id>": "<cat_id>", ...}}

No explanation, no markdown, just the JSON object."""

    try:
        response = await client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()
        # Strip potential markdown code fences
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        result = json.loads(raw)
        # Validate: only keep entries where both IDs are known
        valid_tx_ids = {t["id"] for t in transactions}
        valid_cat_ids = {c["id"] for c in categories}
        return {
            tx_id: cat_id
            for tx_id, cat_id in result.items()
            if tx_id in valid_tx_ids and cat_id in valid_cat_ids
        }
    except Exception as e:
        logger.error(f"Auto-categorization failed: {e}")
        return {}
