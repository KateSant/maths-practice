#!/usr/bin/env bash
#
# Rebuild the local database and keep your ADMIN role.
#
#   ./scripts/dev-reset.sh                                     # uses REALMATHS_ADMIN_EMAIL
#   ./scripts/dev-reset.sh you@gmail.com "Your Name"
#   ./scripts/dev-reset.sh --no-start you@gmail.com            # I'll start the API myself
#
# Why this exists. `rm backend/data/realmaths.db*` is the documented way to rebuild the local
# database, and it silently costs you your role: Flyway carries schema and SEED content, not users,
# so your `users` row is recreated by signing in and comes back as STUDENT. Every reset therefore
# ends with a manual `scripts/make-admin.sh`, and forgetting it is easy because nothing warns you -
# you just find the admin screens gone. This script does the two steps together.
#
# It promotes by PRE-REGISTERING, not by updating an existing row. After a wipe there is no row to
# update: make-admin.sh would refuse, and correctly so, because a role should attach to an identity
# that has authenticated. Pre-registering creates the row with the role already set, and the first
# Google sign-in adopts it (AuthService.linkOrCreate matches on email). That works only when Google
# is authoritative for the address - @gmail.com or a Workspace domain - so the address must be one
# Google vouches for, or sign-in fails as a conflict. make-admin.sh states the same warning.
#
# Configuration comes from the environment, or from .env.local / .env at the repo root if present
# (both are gitignored). REALMATHS_GOOGLE_CLIENT_ID is passed through to the API, so if you keep it
# in .env.local this script starts Google sign-in for you. The file is SOURCED BY THE SHELL, so
# quote any value containing spaces: REALMATHS_ADMIN_NAME="Kate Sant".
#
#   REALMATHS_ADMIN_EMAIL   the account to pre-register as ADMIN
#   REALMATHS_ADMIN_NAME    its display name; falls back to the local part of the address
#   REALMATHS_PORT          the API port; defaults to 8081
#   REALMATHS_GOOGLE_CLIENT_ID   passed through to the API (blank disables Google sign-in)
#
# The API is started in the background and logs to /tmp/realmaths-api.log; `--no-start` skips that
# and leaves you to start it wherever you like (a Terminal window, if you want the logs in front of
# you). The script waits for the port before promoting, because make-admin.sh needs the database to
# exist, and the database is created by the API's first run.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

NO_START=false
EMAIL=""
NAME=""

while [ $# -gt 0 ]; do
  case "$1" in
    --no-start) NO_START=true; shift ;;
    --) shift; break ;;
    -*) echo "unknown option: $1" >&2; exit 2 ;;
    *) break ;;
  esac
done
EMAIL="${1:-${REALMATHS_ADMIN_EMAIL:-}}"
NAME="${2:-${REALMATHS_ADMIN_NAME:-}}"

# Sourced, not exported wholesale: these files hold the developer's own settings, and the API reads
# REALMATHS_* from the environment it is started with.
for f in .env.local .env; do
  if [ -f "$f" ]; then
    # shellcheck disable=SC1090
    set -a; . "./$f"; set +a
    echo "read $f"
  fi
done
EMAIL="${EMAIL:-${REALMATHS_ADMIN_EMAIL:-}}"
NAME="${NAME:-${REALMATHS_ADMIN_NAME:-}}"
PORT="${REALMATHS_PORT:-8081}"
DB="backend/data/realmaths.db"
LOG="/tmp/realmaths-api.log"

if [ ! -f backend/pom.xml ]; then
  echo "ERROR: no backend/pom.xml under $ROOT - run this from the repository." >&2
  exit 1
fi

# --- stop -----------------------------------------------------------------------------------------
# Only this app, and only if it is ours: pkill matches the main class and the maven launcher, not
# every java process on the machine.
if pgrep -f "com.realmaths.RealMathsApplication" >/dev/null 2>&1 \
   || pgrep -f "spring-boot:run" >/dev/null 2>&1; then
  echo "stopping the API"
  pkill -f "com.realmaths.RealMathsApplication" 2>/dev/null || true
  pkill -f "spring-boot:run" 2>/dev/null || true
  for _ in $(seq 1 20); do
    pgrep -f "com.realmaths.RealMathsApplication" >/dev/null 2>&1 || break
    sleep 1
  done
fi
if lsof -ti :"$PORT" >/dev/null 2>&1; then
  echo "ERROR: something is still listening on port $PORT." >&2
  lsof -i :"$PORT" >&2 || true
  exit 1
fi

# --- wipe -----------------------------------------------------------------------------------------
# The -wal and -shm siblings hold committed data that has not been checkpointed yet, so deleting
# only the .db would leave the old content to be replayed into the new file.
if [ -e "$DB" ]; then
  echo "removing $DB (and -wal/-shm)"
fi
rm -f "$DB" "$DB-wal" "$DB-shm"

# --- start ----------------------------------------------------------------------------------------
if [ "$NO_START" = false ]; then
  echo "starting the API, logging to $LOG"
  ( cd backend && nohup mvn -o spring-boot:run >"$LOG" 2>&1 & )
  printf 'waiting for port %s ' "$PORT"
  ready=false
  for _ in $(seq 1 60); do
    sleep 2
    printf '.'
    if curl -s -o /dev/null -m 2 "http://localhost:$PORT/api/topics" 2>/dev/null; then
      ready=true; break
    fi
  done
  echo
  if [ "$ready" != true ]; then
    echo "ERROR: the API did not come up within 120s. Last lines of $LOG:" >&2
    tail -20 "$LOG" >&2 || true
    exit 1
  fi
  if ! grep -q "Started RealMathsApplication" "$LOG" 2>/dev/null; then
    echo "WARNING: port $PORT answered but $LOG has no startup line yet; check it." >&2
  fi
  echo "API up on http://localhost:$PORT"
else
  echo "--no-start: not starting the API. Run it once before promoting, so the database exists."
fi

# --- promote --------------------------------------------------------------------------------------
if [ -z "$EMAIL" ]; then
  echo
  echo "No admin email given, so no role was set. Set REALMATHS_ADMIN_EMAIL in .env.local, or pass"
  echo "an address: ./scripts/dev-reset.sh you@gmail.com \"Your Name\""
  exit 0
fi

if [ "$NO_START" = true ] && [ ! -f "$DB" ]; then
  echo "SKIPPING promotion: no database at $DB yet. Start the API once, then run:"
  echo "  ./scripts/make-admin.sh --pre-register $EMAIL ${NAME:+\"$NAME\"}"
  exit 0
fi

echo
DB="$DB" ./scripts/make-admin.sh --pre-register "$EMAIL" ${NAME:+"$NAME"}
