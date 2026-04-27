"""
Sparkasse CSV format:
- Encoding: ISO-8859-1
- Separator: semicolon
- Columns: Auftragskonto;Buchungstag;Valutadatum;Buchungstext;Auftraggeber/Beguenstigter;
           Kontonummer;BLZ;Betrag;Gläubiger-ID;Mandatsreferenz;Glaeubiger ID;Kundenreferenz;
"""
import io
from datetime import date
from decimal import Decimal, InvalidOperation
import pandas as pd
from .base import ParsedTransaction


def parse(content: bytes) -> list[ParsedTransaction]:
    for enc in ("iso-8859-1", "utf-8-sig"):
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
    df.columns = df.columns.str.strip()

    results = []
    for _, row in df.iterrows():
        booking_raw = str(row.get("Buchungstag", "")).strip()
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

        value_raw = str(row.get("Valutadatum", "")).strip()
        value_date = None
        if value_raw and value_raw != "nan":
            try:
                value_date = date.fromisoformat(
                    value_raw if "-" in value_raw
                    else f"{value_raw[6:10]}-{value_raw[3:5]}-{value_raw[0:2]}"
                )
            except (ValueError, IndexError):
                pass

        counterparty = str(row.get("Auftraggeber/Beguenstigter", "")).strip()
        if counterparty == "nan":
            counterparty = ""
        iban = str(row.get("Kontonummer", "")).strip()
        if iban == "nan":
            iban = ""
        purpose = str(row.get("Buchungstext", "")).strip()
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
