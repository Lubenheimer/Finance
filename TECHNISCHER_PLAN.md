# Technischer Plan: Finanzen-App

> Begleitdokument zu [KONZEPT.md](KONZEPT.md). Beschreibt Architektur, Tech-Entscheidungen und einen schrittweisen Umsetzungspfad.

---

## 1. Architektur-Überblick

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                              │
│              Next.js 15 (App Router) + shadcn               │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS / JSON
┌──────────────────────────▼──────────────────────────────────┐
│                    FastAPI Backend                          │
│  ┌────────────┬──────────────┬──────────────┬────────────┐  │
│  │   Auth     │  REST API    │  Importer    │   Rules    │  │
│  │ (JWT/OAuth)│  (CRUD)      │ (FinTS/CSV/  │  Engine    │  │
│  │            │              │   PDF/MT940) │            │  │
│  └────────────┴──────────────┴──────────────┴────────────┘  │
└────────┬─────────────────────────────────────┬──────────────┘
         │                                     │
┌────────▼──────────┐              ┌───────────▼─────────────┐
│   PostgreSQL 16   │              │    APScheduler          │
│  (Daten + JSONB)  │              │  (Background Jobs:      │
│                   │              │   Bank-Sync, Insights)  │
└───────────────────┘              └─────────────────────────┘

Alles in Docker Compose. Volumes für Postgres + Uploads.
```

**Warum diese Architektur:**
- **Klare Trennung Backend/Frontend** — Frontend kann später durch Mobile/Desktop ersetzt/ergänzt werden
- **APScheduler statt Celery** — kein Redis nötig in Phase 1, einfacher zu betreiben (in-process, persistierbar in Postgres)
- **Postgres mit JSONB** — flexibel für Rohdaten + Regel-Bedingungen, trotzdem relational für Reports

---

## 2. Tech-Stack final

### Backend
- **Python 3.12**
- **uv** als Package Manager (schneller, moderner als Poetry)
- **FastAPI** (REST API, automatische OpenAPI-Doku)
- **SQLAlchemy 2.0** (async) + **Alembic** (Migrations)
- **Pydantic v2** (Validation, Settings)
- **APScheduler** (Background Jobs, persistiert in Postgres)
- **python-fints** (Bank-Anbindung)
- **pdfplumber** (PDF-Parsing)
- **pandas** (Auswertungen, CSV-Import)
- **passlib + python-jose** (Auth, JWT)
- **pytest** + **httpx** (Tests)

### Frontend
- **Next.js 15** (App Router, Server Components)
- **TypeScript** (strict)
- **Tailwind CSS 4** + **shadcn/ui** (Komponenten)
- **TanStack Query** (Server State) + **TanStack Table** (Tabellen)
- **Recharts** (Standard-Charts) + **ECharts** (komplexere wie Sunburst/Treemap)
- **Zod** (Form-Validation, geteilte Schemas mit Backend via OpenAPI-Generator)
- **Auth.js** (Login)
- **React Hook Form** (Formulare)

### Infra
- **Docker Compose** (Orchestrierung)
- **PostgreSQL 16**
- **Caddy** als Reverse Proxy (auto-HTTPS, einfacher als Nginx)
- **Backup**: pg_dump nightly via Cron im Compose

---

## 3. Repository-Struktur

```
Finanzen/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI entrypoint
│   │   ├── config.py                # Pydantic Settings
│   │   ├── db/
│   │   │   ├── base.py              # SQLAlchemy Base
│   │   │   ├── session.py           # async session
│   │   │   └── models/              # ORM models
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── accounts.py
│   │   │       ├── transactions.py
│   │   │       ├── categories.py
│   │   │       ├── rules.py
│   │   │       ├── reports.py
│   │   │       └── auth.py
│   │   ├── schemas/                 # Pydantic DTOs
│   │   ├── services/
│   │   │   ├── importers/
│   │   │   │   ├── base.py
│   │   │   │   ├── csv_ing.py
│   │   │   │   ├── csv_sparkasse.py
│   │   │   │   ├── csv_c24.py
│   │   │   │   ├── fints.py
│   │   │   │   └── pdf.py
│   │   │   ├── rules_engine.py
│   │   │   ├── contract_detector.py
│   │   │   └── reports.py
│   │   ├── jobs/                    # APScheduler tasks
│   │   └── auth/
│   ├── alembic/
│   ├── tests/
│   ├── pyproject.toml
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── app/                     # Next.js App Router
│   │   │   ├── (auth)/login
│   │   │   ├── (app)/
│   │   │   │   ├── dashboard
│   │   │   │   ├── transactions
│   │   │   │   ├── accounts
│   │   │   │   ├── reports
│   │   │   │   ├── budgets
│   │   │   │   ├── contracts
│   │   │   │   ├── household
│   │   │   │   └── settings
│   │   │   └── api/                 # Auth.js routes
│   │   ├── components/
│   │   │   ├── ui/                  # shadcn
│   │   │   ├── charts/
│   │   │   ├── transactions/
│   │   │   └── dashboard/
│   │   ├── lib/
│   │   │   ├── api/                 # generated client
│   │   │   ├── auth.ts
│   │   │   └── utils.ts
│   │   └── hooks/
│   ├── package.json
│   └── Dockerfile
│
├── docker/
│   ├── compose.yml
│   ├── compose.dev.yml
│   ├── Caddyfile
│   └── .env.example
│
├── docs/
│   ├── KONZEPT.md
│   ├── TECHNISCHER_PLAN.md
│   └── adr/                         # Architecture Decision Records
│
├── .gitignore
└── README.md
```

---

## 4. Datenmodell (detailliert)

```sql
-- USERS & HOUSEHOLD
households (id, name, created_at)
users (id, household_id, email, password_hash, name, role, created_at)

-- ACCOUNTS
accounts (
  id, household_id, owner_user_id NULL,    -- NULL = shared
  name, type,                              -- giro|kreditkarte|depot|bargeld|sparbuch
  bank_code, iban NULL, currency,
  visibility,                              -- private|shared
  balance_cached, balance_cached_at,
  sync_method,                             -- fints|csv|manual
  sync_credentials_id NULL,                -- FK auf encrypted credentials
  created_at, archived_at NULL
)

-- TRANSACTIONS
transactions (
  id, account_id,
  booking_date, value_date,
  amount, currency,
  counterparty, counterparty_iban NULL,
  purpose,                                 -- Verwendungszweck
  raw_text,                                -- ungeparster Originaltext
  hash,                                    -- SHA256(account_id+date+amount+purpose) für Dedup
  category_id NULL,
  contract_id NULL,
  parent_transaction_id NULL,              -- für Splits
  paid_by_user_id NULL,                    -- Haushaltsbuch
  split JSONB NULL,                        -- [{user_id, share_pct}]
  tags TEXT[],
  notes TEXT NULL,
  is_transfer BOOL,
  transfer_pair_id NULL,
  imported_at, source                      -- fints|csv:ing|manual
)
CREATE UNIQUE INDEX ON transactions(hash);
CREATE INDEX ON transactions(account_id, booking_date DESC);

-- CATEGORIES
categories (
  id, household_id, parent_id NULL,
  name, icon, color, kind,                 -- income|expense|transfer
  position
)

-- RULES
rules (
  id, household_id, priority,
  name, conditions JSONB,                  -- siehe unten
  actions JSONB,
  active, applied_count, last_applied_at
)

-- CONTRACTS
contracts (
  id, household_id, account_id,
  name, counterparty_pattern,
  expected_amount, amount_tolerance_pct,
  interval,                                -- monthly|quarterly|yearly|custom
  next_due_date, last_seen_date,
  category_id, active,
  cancelable_until NULL, notes
)

-- BUDGETS
budgets (
  id, household_id, category_id,
  period, amount, valid_from, valid_to NULL
)

-- GOALS
goals (
  id, household_id, name,
  target_amount, target_date NULL,
  linked_account_id NULL,
  current_amount_cached
)

-- SECRETS (verschlüsselte Bank-Credentials)
sync_credentials (
  id, account_id,
  encrypted_blob,                          -- AES-GCM, Key aus ENV
  last_sync_at, last_sync_status, last_error
)
```

**Rule-Conditions Beispiel (JSONB):**
```json
{
  "all": [
    {"field": "counterparty", "op": "contains_ci", "value": "REWE"},
    {"field": "amount", "op": "lt", "value": 0}
  ]
}
```

---

## 5. Wichtige technische Entscheidungen (ADR-Style)

### ADR-001: Async vs. Sync SQLAlchemy
→ **Async**, weil FastAPI async ist und Bank-/PDF-Imports oft I/O-lastig sind.

### ADR-002: Dedup über Hash
→ Hash aus `account_id + booking_date + amount + purpose + counterparty`. Kollisionen bei zwei identischen Buchungen am selben Tag sind selten und werden über `imported_at`-Reihenfolge toleriert (manuelle Markierung "wirklich Duplikat?" möglich).

### ADR-003: Transfers
→ Bei jedem Import nach passenden Gegenbuchungen suchen (gleicher Betrag invers, +/- 3 Tage, beide Konten im Haushalt). Auto-Verlinkung mit Bestätigungs-UI.

### ADR-004: Verschlüsselung der Bank-Credentials
→ Symmetrisch (AES-GCM), Master-Key aus ENV-Variable. Bei verlorenem Key müssen Credentials neu eingegeben werden — akzeptabel für self-hosted.

### ADR-005: Multi-User-Auth
→ JWT mit kurzer Lifetime (15 min) + Refresh-Token (7 Tage). Cookie-basiert (HttpOnly, SameSite=Strict).

### ADR-006: Frontend-Backend-Vertrag
→ Backend generiert OpenAPI-Spec, Frontend generiert TS-Client via `openapi-typescript` + `@hey-api/openapi-ts`. Kein manuelles Tippen von API-Typen.

---

## 6. Importer-Pattern

Alle Importer folgen demselben Interface:

```python
class Importer(Protocol):
    name: str

    def can_handle(self, file: UploadFile | bytes) -> bool: ...

    async def parse(self, source) -> list[ParsedTransaction]: ...

class ParsedTransaction(BaseModel):
    booking_date: date
    value_date: date
    amount: Decimal
    currency: str
    counterparty: str
    purpose: str
    raw_text: str
```

Pipeline pro Import:
1. **Parse** → `ParsedTransaction[]`
2. **Hash** & **Dedup** gegen DB
3. **Rules anwenden** (Kategorie, Tags)
4. **Transfer-Detection** (Gegenbuchung suchen)
5. **Contract-Match** (existierende Verträge erkennen)
6. **Persist** in Transaktion
7. **Insights neu berechnen** (async Job triggert)

---

## 7. Sicherheit

- **HTTPS only** (Caddy)
- **Bank-Credentials verschlüsselt** at rest
- **Audit-Log** für sensible Aktionen (Login, Export, Credential-Änderung)
- **Rate-Limit** auf Login + Import
- **CSP** (strict) im Frontend
- **Backups verschlüsselt** (pg_dump | age)
- **Keine Telemetrie**, keine externen Calls außer expliziten Bank-APIs

---

## 8. Umsetzungs-Roadmap (Sprint-orientiert, 2-Wochen-Sprints)

### Sprint 1 — Skelett (Phase 0)
- [ ] Repo + Docker Compose + Postgres laufen
- [ ] Backend: FastAPI Hello-World, `/health`, Alembic-Setup
- [ ] Frontend: Next.js + Tailwind + shadcn aufgesetzt, leere Seiten
- [ ] Auth: Login + JWT funktioniert
- [ ] CI: Lint + Tests in GitHub Actions
- **Done-Kriterium:** `docker compose up` startet alles, Login möglich, Dashboard-Seite zeigt "Hallo {user}"

### Sprint 2 — Konten & manuelle Transaktionen
- [ ] CRUD für Accounts (UI + API)
- [ ] CRUD für Transaktionen (manuelle Eingabe)
- [ ] Kategorien-Verwaltung (hierarchisch)
- [ ] Transaktions-Liste mit Filter, Suche, Sortierung
- **Done:** Du kannst Konten anlegen und Transaktionen manuell eintragen

### Sprint 3 — CSV-Import
- [ ] Importer-Pattern + Pipeline
- [ ] ING-CSV-Profil
- [ ] Sparkasse-CSV-Profil
- [ ] C24-CSV-Profil
- [ ] Dedup via Hash
- [ ] Import-UI mit Preview & Rollback
- **Done:** Echte CSV-Exports deiner drei Banken werden korrekt eingelesen

### Sprint 4 — Regeln & Kategorisierung
- [ ] Rules Engine (Backend)
- [ ] Regel-Editor (Frontend)
- [ ] Bulk-Kategorisieren in Transaktions-Liste
- [ ] Auto-Anwendung bei Import
- **Done:** Eine REWE-Buchung wird automatisch "Lebensmittel"

### Sprint 5 — Dashboard & Standard-Reports
- [ ] Dashboard mit konfigurierbaren Cards
- [ ] Cashflow-Chart
- [ ] Kategorien-Treemap
- [ ] Net-Worth-Verlauf
- [ ] Saved Views
- **Done:** Beim Login sieht man auf einen Blick die wichtigsten Zahlen

### Sprint 6 — Verträge & Forecast
- [ ] Contract-Detection (wiederkehrende Buchungen)
- [ ] Vertrags-Übersicht
- [ ] Forecast nächste 30/90 Tage
- **Done:** Spotify, Netflix etc. tauchen automatisch als Verträge auf

### Sprint 7 — Budgets & Ziele
- [ ] Budget-Modell + UI
- [ ] Sparziel-Modell + UI
- [ ] Budget-Warnungen im Dashboard
- **Done:** Monatsbudget pro Kategorie funktioniert

### Sprint 8 — Haushaltsbuch
- [ ] Mehrere User pro Household
- [ ] Account visibility (private/shared)
- [ ] paid_by + Splits
- [ ] Ausgleichs-Übersicht
- **Done:** Du und Partner:in können getrennt buchen, Ausgleich wird angezeigt

### Sprint 9 — FinTS (Sparkasse + ING)
- [ ] Credential-Management (verschlüsselt)
- [ ] FinTS-Importer
- [ ] ING-Depot über FinTS
- [ ] APScheduler-Job für täglichen Sync
- **Done:** Konten synchronisieren sich automatisch

### Sprint 10 — Polish & Insights
- [ ] PDF-Import als Fallback
- [ ] Insights ("Strom 40% höher")
- [ ] Export (CSV, Excel, PDF-Report)
- [ ] Backup-Skript
- [ ] Doku
- **Done:** App ist im Daily-Use brauchbar

→ **Realistisch:** ~5 Monate bei 1 Sprint = 2 Wochen mit ein paar Stunden pro Woche. Ambitioniert: 3 Monate bei höherer Intensität.

---

## 9. Risiken & Gegenmaßnahmen

| Risiko | Wahrscheinlichkeit | Gegenmaßnahme |
|---|---|---|
| FinTS bricht durch Bank-Update | mittel | CSV-Import als Always-Working-Fallback |
| TAN bei jedem FinTS-Login | mittel | User-Notification + manuelle TAN-Eingabe in UI |
| Performance bei vielen Transaktionen | niedrig | Indizes + Pagination, später Materialized Views für Reports |
| Datenverlust | niedrig (mit Backup) | Nightly pg_dump, dokumentierter Restore-Prozess |
| Krypto-Komplexität (Phase 4) | hoch | Bewusst rausgehalten, nur wenn wirklich nötig |
| Scope-Creep | hoch | Strikt an Sprint-Plan halten, neue Ideen ins Backlog |

---

## 10. Nächster konkreter Schritt

Sprint 1 starten:
1. `git init`, `.gitignore`, Repo-Struktur anlegen
2. `docker/compose.dev.yml` mit Postgres + Backend + Frontend
3. Backend: FastAPI + SQLAlchemy + Alembic Bootstrap
4. Frontend: `pnpm create next-app` + Tailwind + shadcn init
5. Health-Check-Endpoint und Frontend-Aufruf, der ihn anzeigt

Sag Bescheid, ob ich den Sprint 1 (Skelett) direkt anlegen soll — dann starte ich mit der Repo-Initialisierung und den ersten Files.
