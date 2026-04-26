# Konzept: Moderne Finanz-App (Arbeitstitel: "Finanzen")

> Ziel: Eine selbstgehostete, moderne Finanz-App als bessere Alternative zu Finanzguru — mit voller Datenhoheit, flexiblen Auswertungen und einem aufgeräumten Dashboard.

---

## 1. Vision & Abgrenzung zu Finanzguru

**Was Finanzguru gut macht:**
- Automatische Kategorisierung
- Vertragserkennung
- Saubere Mobile-UX

**Was oft fehlt / nervt:**
- Wenig Flexibilität bei Kategorien & Regeln
- Auswertungen sind oberflächlich (kein echter Drill-Down, keine Custom-Reports)
- Daten liegen beim Anbieter (DSGVO/Privacy)
- Schlechte CSV-/PDF-Importe für Konten ohne PSD2
- Kein vernünftiger Multi-Asset-Blick (Depot + Konto + Bargeld + Krypto)
- Mobile-only — kein vollwertiger Desktop-Workflow

**Unsere Leitprinzipien:**
1. **Local-first / Self-hosted** — Daten bleiben auf eigenem Gerät/Server
2. **Desktop-first, Mobile-ready** — primär Web-App, responsive, später ggf. PWA
3. **Alles ist eine Transaktion** — einheitliches Datenmodell für Konto, Karte, Depot, Bargeld
4. **Regeln statt Magie** — nachvollziehbare, editierbare Kategorisierung
5. **Keep it boring** — bewährter Tech-Stack, keine Experimente bei den Finanzdaten

---

## 2. Feature-Set

### 2.1 Datenimport
- **Bank-Schnittstelle (PSD2 / FinTS)**
  - FinTS/HBCI für deutsche Banken (z.B. via [python-fints](https://github.com/raphaelm/python-fints))
  - PSD2-Aggregator als Alternative: GoCardless Bank Account Data (ehem. Nordigen) — kostenlos, EU-weit, viele Banken
  - Optional: Plaid (USA), SaltEdge (global)
- **Datei-Import**
  - CSV (mit Format-Profilen pro Bank)
  - MT940 / CAMT.053 (Standard-Bankformate)
  - PDF-Kontoauszüge (mit `pdfplumber` + Heuristiken pro Bank)
  - Excel (Depots, Sparkonten, Kreditkarten-Abrechnungen)
- **Manuelle Eingabe** für Bargeld
- **Krypto/Depot** (optional Phase 2): Trade Republic, Scalable, Bitpanda via CSV; später APIs

### 2.2 Kategorisierung & Regeln
- Hierarchische Kategorien (z.B. Wohnen → Miete, Wohnen → Strom)
- **Regelsystem**: "Wenn Empfänger enthält X UND Betrag < Y → Kategorie Z"
- Auto-Kategorisierung via Regeln + optional ML-Vorschlag (z.B. Embedding-Match auf bisherige Buchungen)
- **Vertragserkennung**: wiederkehrende Buchungen (gleicher Empfänger, ähnlicher Betrag, regelmäßiger Abstand) → Abos & Verträge
- Splits: eine Buchung in mehrere Kategorien aufteilen
- Tags zusätzlich zu Kategorien (z.B. `#urlaub-2026`, `#gemeinsam`)

### 2.3 Auswertungen
- **Standard-Reports**
  - Cashflow (Einnahmen vs. Ausgaben über Zeit)
  - Kategorien-Breakdown (Sunburst / Treemap)
  - Vermögensentwicklung (Net Worth über Zeit, alle Konten)
  - Vertrags-Übersicht (monatliche Fixkosten)
  - Forecast: erwartete Ausgaben nächste 30/90 Tage basierend auf Verträgen
- **Custom Reports**
  - Filter über Zeit, Konten, Kategorien, Tags, Empfänger, Betrag
  - Speicherbare Sichten ("Saved Views")
  - Vergleichszeiträume (YoY, MoM)
- **Budgets & Ziele**
  - Monatsbudget pro Kategorie
  - Sparziele (Notgroschen, Urlaub, …)
  - Frühwarnung bei Budget-Überschreitung
- **Insights**
  - Auffällige Abweichungen ("Stromrechnung 40% höher als Vormonat")
  - Doppelt gezahlte Abos
  - Ungenutzte Abos (lange keine Nutzung — schwer zu erkennen, eher nice-to-have)

### 2.4 Dashboard
- **Hero-KPIs oben**: Net Worth, Cashflow MTD, Sparquote, freies Budget
- **Karten-Layout** mit Drag&Drop-Anpassung:
  - Letzte Transaktionen
  - Top-Kategorien des Monats
  - Anstehende Verträge / Lastschriften
  - Sparziel-Fortschritt
  - Vermögensverteilung (Konten / Asset-Klassen)
  - Trend-Charts
- Dark Mode default, helles Theme verfügbar

### 2.5 Sonstiges
- Multi-Currency (zumindest EUR/USD)
- Mehrere Profile / Haushalte (du + Partner:in, getrennte und gemeinsame Konten)
- Volltextsuche über alle Buchungen
- Export: CSV, Excel, PDF-Reports
- 2FA fürs Login

---

## 3. Tech-Stack-Vorschlag

| Schicht | Vorschlag | Begründung |
|---|---|---|
| Backend | **Python + FastAPI** | Beste Bibliotheken für FinTS, PDF-Parsing, Pandas für Auswertungen |
| Datenbank | **PostgreSQL** | Robust, JSONB für flexible Felder, gut für Zeitreihen |
| Frontend | **Next.js + TypeScript + Tailwind + shadcn/ui** | Modern, schnell, schöne Components out-of-the-box |
| Charts | **Recharts** oder **Apache ECharts** | ECharts mächtiger, Recharts einfacher |
| Auth | **Auth.js** (NextAuth) oder eigenes JWT | Local-first reicht simpler Login |
| Background Jobs | **Celery + Redis** oder **APScheduler** | Für regelmäßige Bank-Sync-Jobs |
| Deployment | **Docker Compose** | Self-Host auf NAS / Homeserver / VPS |
| Bank-API | **GoCardless Bank Account Data** + **python-fints** als Fallback | EU-Banken-Coverage |

**Alternative für Solo-Dev / schneller:**
- Komplett **Next.js + Prisma + SQLite** (Monorepo, ein Deployment) — pragmatisch, wenn du nicht zwei Sprachen pflegen willst. Nachteil: FinTS/PDF in Node ist deutlich schmerzhafter.

**Empfehlung:** Backend Python, Frontend Next.js. Die Trennung lohnt sich, weil die Finanz-Bibliotheken-Welt klar in Python lebt.

---

## 4. Datenmodell (Skizze)

```
Account
  id, name, type (giro|karte|depot|bargeld|krypto), bank, iban, currency, balance_cached

Transaction
  id, account_id, booking_date, value_date, amount, currency,
  counterparty, purpose, raw_text, hash (für Dedup),
  category_id, tags[], split_of_id?, contract_id?, notes

Category
  id, parent_id, name, icon, color, kind (income|expense|transfer)

Rule
  id, priority, conditions (JSON), action (set_category, set_tag, …), active

Contract
  id, name, counterparty_pattern, expected_amount, interval, next_due, category_id

Budget
  id, category_id, period (monthly|yearly), amount

Goal
  id, name, target_amount, current_amount, target_date, linked_account_id
```

Wichtig: **Transfers zwischen eigenen Konten** als spezieller Typ — sonst werden sie doppelt als Einnahme+Ausgabe gezählt und verfälschen alle Reports.

---

## 5. Roadmap (in Iterationen)

### Phase 0 — Fundament (Woche 1–2)
- Projekt-Setup, Repo, Docker Compose
- DB-Schema, Migrationen
- Basis-Auth, leeres Dashboard-Skelett

### Phase 1 — MVP Import & Anzeigen (Woche 3–5)
- CSV-Import mit Bank-Profilen
- Konten- und Transaktions-Listen
- Manuelle Kategorisierung
- Einfaches Dashboard (Cashflow, Top-Kategorien)

### Phase 2 — Automatisierung (Woche 6–8)
- Regelsystem
- Vertragserkennung
- FinTS- oder GoCardless-Anbindung
- Background-Sync

### Phase 3 — Auswertungen & Budgets (Woche 9–11)
- Custom Reports & Saved Views
- Budgets & Sparziele
- Forecast
- Insights

### Phase 4 — Komfort (Woche 12+)
- PDF-Import
- Multi-User / Haushalt
- PWA / Mobile-Optimierung
- Depot- & Krypto-Anbindung

---

## 6. Getroffene Entscheidungen (2026-04-26)

| Frage | Entscheidung | Konsequenz |
|---|---|---|
| Hosting | **Self-hosted, lokal** für Prototyp | Docker Compose, später ggf. NAS/VPS |
| Banken | **Sparkasse, ING DiBa, C24** | siehe Bank-Strategie unten |
| Nutzer | **Haushalt** (Multi-User) | User-/Haushalts-Modell von Anfang an, geteilte + private Konten |
| Mobile | **Nicht kritisch** | Responsive Web reicht, keine PWA/Native in Phase 1 |
| Depot | **ING-Depot inkludieren** | Wertpapier-Datenmodell von Anfang mitdenken |
| Bau | **Eigenbau** | Python/FastAPI + Next.js wie skizziert |
| Haushaltsbuch | **Ja, explizit** | siehe eigenen Abschnitt 7 |

### 6.1 Bank-Anbindungs-Strategie

| Bank | Beste Methode | Notizen |
|---|---|---|
| **Sparkasse** | FinTS/HBCI (PIN/TAN) | Funktioniert seit Jahren stabil mit `python-fints`. PIN nötig, TAN nur bei Transaktionen — reines Lesen meist ohne TAN möglich. |
| **ING DiBa** | FinTS | Konten + Depot über FinTS abrufbar. Depot-Bestände als spezieller FinTS-Geschäftsvorfall. |
| **C24 (Smart)** | **CSV-Export**, kein FinTS | C24 bietet kein offenes FinTS. Workaround: regelmäßiger CSV/PDF-Export aus der App, manueller Import. PSD2 via GoCardless als Fallback prüfen. |

→ **Phase 1 setzt auf FinTS für Sparkasse + ING und sauberen CSV-Import für C24.** GoCardless erst, wenn FinTS-Pflege nervt.

---

## 7. Haushaltsbuch-Modul

Ergänzend zum automatischen Banking-Sync — für alles, was nicht über Konten läuft (Bargeld, Splitting im Haushalt, "wer hat was bezahlt"):

- **Bargeld-Buchungen** manuell (mit Foto vom Kassenbon optional)
- **Schnellerfassung** (Floating-Action-Button, 3 Klicks: Betrag, Kategorie, Kommentar)
- **Wer-hat-bezahlt-Logik**: jede Buchung kann einem User zugeordnet werden, gemeinsame Buchungen splittbar (50/50 oder custom)
- **Haushaltskasse**: virtueller "Kasse"-Konto-Typ, Einzahlung von beiden Partnern
- **Ausgleichs-Übersicht**: "Wer schuldet wem wie viel" (Splitwise-light)
- **Einkaufsliste / wiederkehrende Posten** (nice-to-have, evtl. später)

Datenmodell-Erweiterung:
```
User
  id, name, email, household_id

Household
  id, name

Account
  + visibility (private|shared), owner_user_id

Transaction
  + paid_by_user_id, split (JSON: [{user_id, share}, …])
```

---

## 8. Konkretisierter Phase-0-Plan (nächste 1–2 Wochen)

1. **Repo-Struktur** anlegen
   ```
   /backend      (FastAPI, Python 3.12, Poetry/uv)
   /frontend     (Next.js 15, TS, Tailwind, shadcn)
   /docker       (compose.yml, Dockerfiles)
   /docs         (KONZEPT.md, ADRs)
   ```
2. **Docker Compose** mit Postgres + Backend + Frontend, ein `docker compose up` startet alles
3. **DB-Schema** (Alembic) mit Account, Transaction, Category, User, Household
4. **Auth**: simpler User-Login (Email/PW + 2FA optional) — Auth.js im Frontend, JWT-Validierung im Backend
5. **Leeres Dashboard** + Konten-Liste + Transaktions-Liste (noch ohne Daten)
6. **Erster Import**: CSV-Upload für ING (deren Format ist gut dokumentiert) → Transaktionen landen in DB

Damit hast du nach Phase 0 das Skelett und kannst echte Daten reinwerfen.

---

## 7. Bonus: Open-Source-Alternativen, die wir evtl. forken/nutzen können

- **Firefly III** (PHP, Laravel) — sehr mächtig, hässlich, schwer anzupassen
- **Actual Budget** (JS/React) — sehr aktiv, schöner, Fokus auf Envelope-Budgeting
- **Maybe Finance** (Ruby on Rails) — modern, schick, seit 2024 wieder Open Source
- **Ghostfolio** (Node/Angular) — Fokus auf Wealth/Depot, weniger auf Cashflow

**Empfehlung zum Reinschauen:** Maybe Finance als Inspiration für UX, evtl. Actual Budget für Budget-Mechanik. Für das Konzept hier: eigener Bau, weil Flexibilität bei Importen und Auswertungen die Kernschwäche der Alternativen ist.
```

