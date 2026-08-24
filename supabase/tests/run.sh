#!/usr/bin/env bash
# Replay every migration into a scratch Postgres and assert the local
# association name behaviour (display-name resolution + RLS).
#
# Needs a local Postgres 15+ on PATH. Nothing here touches the real project.
#
#   ./supabase/tests/run.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TESTS="$ROOT/supabase/tests"
WORK="${TMPDIR:-/tmp}/job-board-pgtest"
SOCK="/tmp/jbpg"          # kept short: socket paths cap at ~103 bytes
PORT=55432

mkdir -p "$SOCK"

if ! pg_isready -h "$SOCK" -p "$PORT" >/dev/null 2>&1; then
  echo "==> starting scratch Postgres in $WORK"
  rm -rf "$WORK"
  mkdir -p "$WORK"
  initdb -D "$WORK/pgdata" -U postgres >/dev/null
  pg_ctl -D "$WORK/pgdata" -o "-k $SOCK -p $PORT -h ''" -l "$WORK/pg.log" start >/dev/null
  trap 'pg_ctl -D "$WORK/pgdata" stop >/dev/null 2>&1 || true' EXIT
  sleep 2
fi

PSQL="psql -h $SOCK -p $PORT -U postgres -v ON_ERROR_STOP=1"

run_suite() {
  local db="$1" suite="$2"
  $PSQL -q -c "DROP DATABASE IF EXISTS $db;" -c "CREATE DATABASE $db;" >/dev/null

  # Supabase-shaped scaffolding (auth/storage/vault/net) the migrations expect.
  $PSQL -d "$db" -q -f "$TESTS/00-supabase-stub.sql" >/dev/null

  # pg_net can't be installed locally; the stub supplies net.http_post instead.
  local mig="$WORK/mig"
  rm -rf "$mig"; mkdir -p "$mig"
  for f in "$ROOT"/supabase/migrations/*.sql; do
    sed 's/^CREATE EXTENSION IF NOT EXISTS pg_net.*$/-- (pg_net stubbed for local validation)/' \
      "$f" > "$mig/$(basename "$f")"
  done
  for f in $(ls "$mig"/*.sql | sort); do
    $PSQL -d "$db" -q -f "$f" >/dev/null
  done

  # Let the notification triggers actually reach the stubbed net.http_post.
  $PSQL -d "$db" -q -c \
    "INSERT INTO vault.decrypted_secrets VALUES ('supabase_url','https://example.supabase.co'), ('function_secret','s3cr3t');" >/dev/null

  echo "==> $suite"
  $PSQL -d "$db" -f "$TESTS/$suite"
}

run_suite jb_test_altnames alt-names.sql
run_suite jb_test_rls rls.sql

echo
echo "==> done. Any 'SECURITY FAIL' above is a real regression."
