#!/usr/bin/env bash
# ── Finance App – Dev-Start ────────────────────────────────────────────────────
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"

# Homebrew-Pfad explizit setzen (für Aufrufe ohne Login-Shell)
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:$PATH"

GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

# ── 1. Postgres (Docker) ───────────────────────────────────────────────────────
printf "${CYAN}[1/3] Postgres...${NC}\n"
if lsof -i :5432 -sTCP:LISTEN -t &>/dev/null; then
  printf "      ${GREEN}bereits aktiv auf :5432${NC}\n"
else
  docker compose -f "$ROOT/docker/compose.dev.yml" up -d --wait
  printf "      ${GREEN}gestartet${NC}\n"
fi

# ── 2. Backend ─────────────────────────────────────────────────────────────────
printf "${CYAN}[2/3] Backend  (http://localhost:8000)...${NC}\n"
if curl -sf http://localhost:8000/health &>/dev/null; then
  printf "      ${GREEN}bereits aktiv auf :8000${NC}\n"
else
  export DATABASE_URL="postgresql+asyncpg://finanzen:devpassword@127.0.0.1:5432/finanzen"
  export SECRET_KEY="dev-secret-key-sprint1"
  cd "$ROOT/backend"
  uv run uvicorn app.main:app --reload --reload-exclude ".venv" --host 0.0.0.0 --port 8000 \
    > /tmp/finance-backend.log 2>&1 &
  printf "      warte auf Start"
  for i in $(seq 1 30); do
    sleep 1
    if curl -sf http://localhost:8000/health &>/dev/null; then
      printf " ${GREEN}bereit (${i}s)${NC}\n"; break
    fi
    printf "."
    if [[ $i -eq 30 ]]; then
      printf "\n      ${RED}Timeout — Log: /tmp/finance-backend.log${NC}\n"; exit 1
    fi
  done
  cd "$ROOT"
fi

# ── 3. Frontend ────────────────────────────────────────────────────────────────
printf "${CYAN}[3/3] Frontend (http://localhost:3000)...${NC}\n"
export NEXT_PUBLIC_API_URL="http://localhost:8000"
# Node.js v22+ definiert localStorage als leeres Objekt — für Next.js deaktivieren
export NODE_OPTIONS="--no-experimental-webstorage"
cd "$ROOT/frontend"
pnpm dev > /tmp/finance-frontend.log 2>&1 &
cd "$ROOT"

printf "\n${YELLOW}Alle Dienste laufen:${NC}\n"
printf "  Frontend  ->  http://localhost:3000\n"
printf "  Backend   ->  http://localhost:8000\n"
printf "  API Docs  ->  http://localhost:8000/docs\n"
printf "  Logs:  /tmp/finance-backend.log  |  /tmp/finance-frontend.log\n"
