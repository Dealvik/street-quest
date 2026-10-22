#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

sudo service postgresql start
for _ in $(seq 1 30); do
  pg_isready -q && break
  sleep 1
done

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname = 'ubuntu'" | grep -q 1; then
  sudo -u postgres createuser -s ubuntu
fi
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname = 'streetquest'" | grep -q 1; then
  sudo -u postgres createdb -O ubuntu streetquest
fi
sudo -u postgres psql -d streetquest -c "CREATE EXTENSION IF NOT EXISTS postgis"
sudo -u postgres psql -d streetquest -c "CREATE EXTENSION IF NOT EXISTS pgcrypto"

export DATABASE_URL="${DATABASE_URL:-postgres://ubuntu@/streetquest?host=/var/run/postgresql}"
export JWT_SECRET="${JWT_SECRET:-dev-only-street-quest-jwt-secret}"
export PORT="${PORT:-4000}"
export EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL:-http://127.0.0.1:4000}"

npm run migrate -w @street-quest/api

if ! tmux has-session -t streetquest-api 2>/dev/null; then
  tmux new-session -d -s streetquest-api \
    "cd /workspace && DATABASE_URL='${DATABASE_URL}' JWT_SECRET='${JWT_SECRET}' PORT='${PORT}' npm run start:api"
fi
if ! tmux has-session -t streetquest-web 2>/dev/null; then
  tmux new-session -d -s streetquest-web \
    "cd /workspace && EXPO_NO_TELEMETRY=1 EXPO_PUBLIC_API_URL='${EXPO_PUBLIC_API_URL}' BROWSER=none npm run dev:web -- --port 8081"
fi

ready=0
for _ in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:${PORT}/health" >/dev/null; then
    ready=1
    break
  fi
  sleep 1
done
if [ "$ready" -ne 1 ]; then
  echo "API did not become ready on port ${PORT}" >&2
  exit 1
fi
