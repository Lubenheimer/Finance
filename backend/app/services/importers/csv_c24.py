"""
C24 Bank CSV export format:
- Encoding: UTF-8
- Separator: semicolon
- Columns: Datum;Empfänger/Auftraggeber;Buchungstext;Betrag;Währung;Kontostand nach Buchung
"""
import io
from datetime import date
from decimal import Decimal, InvalidOperation
import pandas as pd
from .base import ParsedTransaction


def parse(content: bytes) -> list[ParsedTransaction]:
    for enc in ("utf-8-sig", "utf-8", "iso-8859-1"):
        try:
            text = content.decode(enc)
            break
        except UnicodeDecodeError:
            continue

    lines = text.splitlines()
    header_idx = None
    for i, line in enumerate(lines):
        if "Datum" in line and "Betrag" in line:
            header_idx = i
            break

    if header_idx is None:
        raise ValueError("C24 CSV: Keine Headerzeile gefunden")

    csv_text = "\n".join(lines[header_idx:])
    df = pd.read_csv(io.StringIO(csv_text), sep=";", dtype=str)
    df.columns = df.columns.str.strip()

    results = []
    for _, row in df.iterrows():
        booking_raw = str(row.get("Datum", "")).strip()
        if not booking_raw or booking_raw == "nan":
            continue
        try:
            booking = date.fromisoformat(
                booking_raw if "-" in booking_raw
                else f"{booking_raw[6:10]}-{booking_raw[3:5]}-{booking_raw[0:2]}"
            )
        except (ValueError, IndexError):
            continue

        amount_raw = str(row.get("Betrag", "0")).strip().replace(".", "").replace(",", ".")
        try:
            amount = Decimal(amount_raw)
        except InvalidOperation:
            continue

        currency = str(row.get("Währung", "EUR")).strip()
        if currency == "nan":
            currency = "EUR"

        counterparty = str(row.get("Empfänger/Auftraggeber", "")).strip()
        if counterparty == "nan":
            counterparty = ""
        purpose = str(row.get("Buchungstext", "")).strip()
        if purpose == "nan":
            purpose = ""

        results.append(ParsedTransaction(
            booking_date=booking,
            amount=amount,
            currency=currency,
            counterparty=counterparty,
            purpose=purpose,
            raw_text=";".join(str(v) for v in row.values),
        ))
    return results
