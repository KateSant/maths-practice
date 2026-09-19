#!/usr/bin/env bash
#
# Grant the ADMIN role to an existing account.
#
# There is deliberately no UI for this, and no allowlist in configuration. There is one
# administrator, she is promoted by hand, and the role lives in the users table where
# JwtToUserPrincipalConverter reads it on every request. The practical consequence is that the
# change takes effect on her next request: no re-login, no reissued token, no cache to clear.
#
#   ./scripts/make-admin.sh jo@example.com
#   DB=/tmp/copy.db ./scripts/make-admin.sh jo@example.com
#
# The account must already exist, which means she signs in once (Google creates the row) and
# then we promote it. Refusing to invent a row is the point: a role can only attach to an
# identity that has actually authenticated.
#
# Against the deployed instance the database is inside the api container's volume, so run the
# same statement there instead:
#
#   ssh <host> "cd /srv/realmaths && docker compose -f docker-compose.prod.yml \
#     exec -T api sh -c 'command -v sqlite3 >/dev/null || exit 1; sqlite3 /data/realmaths.db \
#     \"update users set role = 'ADMIN' where email = '\''jo@example.com'\'';\"'"
#
# (Or copy the file out and edit it locally, which is simpler and less quoting.)

set -euo pipefail

DB="${DB:-backend/data/realmaths.db}"
EMAIL="${1:-}"

if [ -z "$EMAIL" ]; then
  echo "usage: $0 <email>" >&2
  exit 2
fi

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "ERROR: sqlite3 is not installed." >&2
  exit 1
fi

if [ ! -f "$DB" ]; then
  echo "ERROR: no database at $DB" >&2
  echo "       Run the API once to create it, or set DB=/path/to/realmaths.db" >&2
  exit 1
fi

# Normalised the same way AuthService normalises it, so the match is not defeated by case.
NORMALISED="$(printf '%s' "$EMAIL" | tr '[:upper:]' '[:lower:]' | sed 's/^ *//; s/ *$//')"

EXISTING_ROLE="$(sqlite3 "$DB" "select role from users where lower(email) = '$NORMALISED';")"

if [ -z "$EXISTING_ROLE" ]; then
  echo "ERROR: no account for $NORMALISED in $DB" >&2
  echo "       Existing accounts:" >&2
  sqlite3 "$DB" "select '         ' || email || ' (' || role || ')' from users order by id;" >&2
  exit 1
fi

if [ "$EXISTING_ROLE" = "ADMIN" ]; then
  echo "$NORMALISED is already ADMIN. Nothing to do."
  exit 0
fi

sqlite3 "$DB" "update users set role = 'ADMIN' where lower(email) = '$NORMALISED';"
echo "$NORMALISED: $EXISTING_ROLE -> ADMIN (in $DB)"
echo "Takes effect on her next request; no re-login needed."
