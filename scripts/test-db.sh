#!/usr/bin/env bash
# Aplica as migrações numa base PostgreSQL descartável e corre supabase/tests.
# Uso: DATABASE_URL=postgres://postgres@localhost:5432/postgres pnpm test:db
# (precisa de um PostgreSQL 15+ local; NÃO apontar para o projecto Supabase).
set -euo pipefail
cd "$(dirname "$0")/.."

: "${DATABASE_URL:?Define DATABASE_URL para um PostgreSQL local descartável}"
db="biska_test_$$"
psql "$DATABASE_URL" -qX -v ON_ERROR_STOP=1 -c "create database $db"
trap 'psql "$DATABASE_URL" -qX -c "drop database if exists $db with (force)" >/dev/null' EXIT

url="${DATABASE_URL%/*}/$db"
run() { psql "$url" -qX -v ON_ERROR_STOP=1 "$@"; }

run -f supabase/tests/supabase_stubs.sql
for f in supabase/migrations/*.sql; do run -f "$f"; done
run -f supabase/seed.sql
for f in supabase/tests/*.sql; do
  [[ "$f" == */supabase_stubs.sql ]] && continue
  echo "== $f"
  run -f "$f"
done
