# Finanzen

Persönliche Finanz-App für Haushalt, Konten (Sparkasse, ING DiBa, C24) und Depot.

## Schnellstart (Entwicklung)

### Voraussetzungen
- Docker Desktop
- Node.js 22 + pnpm (`npm i -g pnpm`)
- Python 3.12 + uv (`pip install uv` oder `winget install astral-sh.uv`)

### 1 — Datenbank starten

```bash
cd docker
cp .env.example .env          # einmalig, Werte anpassen
docker compose -f compose.dev.yml up -d
```

### 2 — Backend starten

```bash
cd backend
uv sync
cp ../docker/.env.example .env   # ggf. DATABASE_URL auf localhost setzen
uv run alembic upgrade head
uv run uvicorn app.main:app --reload
# → http://localhost:8000/docs
```

### 3 — Frontend starten

```bash
cd frontend
pnpm install
cp ../docker/.env.example .env.local
pnpm dev
# → http://localhost:3000
```

Beim ersten Aufruf auf `/login` → "Konto erstellen" → Haushalt + E-Mail + Passwort eingeben.

---

## Produktiv-Deployment (Docker Compose)

```bash
cd docker
cp .env.example .env   # alle Werte setzen (SECRET_KEY etc.)
docker compose up -d
# → Backend: http://localhost:8000
# → Frontend: http://localhost:3000
```

---

## Projektstruktur

```
backend/    FastAPI · SQLAlchemy · Alembic · Python 3.12
frontend/   Next.js 15 · Tailwind 4 · shadcn/ui · TypeScript
docker/     compose.yml · compose.dev.yml · .env.example
docs/       KONZEPT.md · TECHNISCHER_PLAN.md
```

## Backend-API

Nach dem Start erreichbar unter `http://localhost:8000/docs` (Swagger UI).

Wichtige Endpoints:
- `POST /api/v1/auth/register` — Erstregistrierung (legt Haushalt an)
- `POST /api/v1/auth/login` — Login (setzt HttpOnly-Cookie)
- `GET  /api/v1/auth/me` — Aktueller User
- `POST /api/v1/auth/logout` — Logout
- `GET  /health` — Health-Check

## Tests

```bash
cd backend
uv run pytest
```

## Roadmap

Siehe [docs/TECHNISCHER_PLAN.md](docs/TECHNISCHER_PLAN.md) — Sprint-Plan bis Sprint 10.
