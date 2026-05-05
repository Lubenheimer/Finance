"""
Sparkasse CSV format:
- Encoding: ISO-8859-1 (or UTF-8)
- Separator: semicolon
- Dates: DD.MM.YYYY or DD.MM.YY (2-digit year)
- Columns (two known variants):
    Variant A: Auftraggeber/Beguenstigter, Buchungstext (as purpose)
    Variant B: Beguenstigter/Zahlungspflichtiger, Verwendungszweck (as purpose)
"""
import io
from datetime import date
from decimal import Decimal, InvalidOperation
import pandas as pd
from .base import ParsedTransaction


def _parse_de_date(raw: str) -> date | None:
    """Parse DD.MM.YY or DD.MM.YYYY → date. Returns None on failure."""
    raw = raw.strip()
    if not raw or raw == "nan":
        return None
    if "-" in raw:
        try:
            return date.fromisoformat(raw)
        except ValueError:
            return None
    parts = raw.split(".")
    if len(parts) != 3:
        return None
    day, month, year = parts[0], parts[1], parts[2]
    if len(year) == 2:
        year = "20" + year
    try:
        return date.fromisoformat(f"{year}-{month}-{day}")
    except ValueError:
        return None


def parse(content: bytes) -> list[ParsedTransaction]:
    for enc in ("iso-8859-1", "utf-8-sig", "utf-8"):
        try:
            text = content.decode(enc)
            break
        except UnicodeDecodeError:
            continue

    lines = text.splitlines()
    header_idx = None
    for i, line in enumerate(lines):
        if "Buchungstag" in line or "Auftragskonto" in line:
            header_idx = i
            break

    if header_idx is None:
        raise ValueError("Sparkasse CSV: Keine Headerzeile gefunden")

    csv_text = "\n".join(lines[header_idx:])
    df = pd.read_csv(io.StringIO(csv_text), sep=";", dtype=str)
    df.columns = df.columns.str.strip().str.strip('"')

    # Detect column variants
    # Counterparty: "Beguenstigter/Zahlungspflichtiger" (newer) or "Auftraggeber/Beguenstigter" (older)
    counterparty_col = next(
        (c for c in df.columns if "Beguenstigter" in c or "Auftraggeber" in c),
        None,
    )
    # Purpose: "Verwendungszweck" preferred, fallback "Buchungstext"
    purpose_col = "Verwendungszweck" if "Verwendungszweck" in df.columns else "Buchungstext"
    # IBAN: "Kontonummer/IBAN" or "Kontonummer"
    iban_col = next((c for c in df.columns if "Kontonummer" in c), None)

    results = []
    for _, row in df.iterrows():
        booking_raw = str(row.get("Buchungstag", "")).strip()
        booking = _parse_de_date(booking_raw)
        if booking is None:
            continue

        amount_raw = str(row.get("Betrag", "0")).strip().replace(".", "").replace(",", ".")
        try:
            amount = Decimal(amount_raw)
        except InvalidOperation:
            continue

        value_date = _parse_de_date(str(row.get("Valutadatum", "")))

        counterparty = ""
        if counterparty_col:
            counterparty = str(row.get(counterparty_col, "")).strip()
            if counterparty == "nan":
                counterparty = ""

        iban = ""
        if iban_col:
            iban = str(row.get(iban_col, "")).strip()
            if iban == "nan":
                iban = ""

        purpose = str(row.get(purpose_col, "")).strip()
        if purpose == "nan":
            purpose = ""

        results.append(ParsedTransaction(
            booking_date=booking,
            value_date=value_date,
            amount=amount,
            counterparty=counterparty,
            counterparty_iban=iban,
            purpose=purpose,
            raw_text=";".join(str(v) for v in row.values),
        ))
    return results
