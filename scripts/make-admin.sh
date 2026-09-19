#!/usr/bin/env bash
#
# Grant the ADMIN role to an account.
#
# There is deliberately no UI for this and no allowlist in configuration. There is exactly one
# administrator, she is promoted by hand, and the role lives in the users table where
# JwtToUserPrincipalConverter reads it on every request. The practical consequence is that the
# change takes effect on her next request: no re-login, no reissued token, no cache to clear.
#
#   ./scripts/make-admin.sh jo@example.com                  # promote an account that exists
#   ./scripts/make-admin.sh --pre-register susan@gmail.com "Susan Watts"
#
# The account normally has to exist already, which means she signs in once (Google creates the
# row) and then we promote it. Refusing to invent a row is the point: a role should attach to an
# identity that has actually authenticated.
#
# --pre-register exists for the case where someone wants the account ready *before* first
# sign-in. It creates the row with the role already set, and Google then adopts that row:
# AuthService.linkOrCreate finds it by email and attaches the identity rather than creating a
# second account. Two consequences worth knowing:
#
#   * The display name set here is the one she keeps. Linking does not overwrite it with the
#     name from her Google profile, so pass the name you want her to see.
#   * THE ADDRESS MUST BE ONE GOOGLE VOUCHES FOR. Identity is linked by email only when Google
#     is authoritative for it, which means @gmail.com or a Workspace domain - exactly the case
#     where Google issued the address. Pre-registering a third-party address (a school address
#     hosted elsewhere, say) makes sign-in fail outright with a conflict, because attaching it
#     would hand the account to whoever controls that Google account. The script warns below.
#
# Against the deployed instance the database lives in a Docker volume and neither the host nor
# the container ships sqlite3, so a temporary container is the least invasive way in:
#
#   ssh -i ~/.ssh/realmaths-deploy ubuntu@<ip> "docker run --rm -v realmaths_realmaths-data:/data \
#     alpine:3 sh -c 'apk add --no-cache sqlite >/dev/null && sqlite3 /data/realmaths.db \"...\"'"
#
# Stop the api container first if you would rather not write while it is running. A single
# INSERT is safe under WAL with a busy timeout, which is how the JDBC URL is configured.

set -euo pipefail

DB="${DB:-backend/data/realmaths.db}"
PRE_REGISTER=false

while [ $# -gt 0 ]; do
  case "$1" in
    --pre-register) PRE_REGISTER=true; shift ;;
    --) shift; break ;;
    -*) echo "unknown option: $1" >&2; exit 2 ;;
    *) break ;;
  esac
done

EMAIL="${1:-}"
DISPLAY_NAME="${2:-}"

if [ -z "$EMAIL" ]; then
  echo "usage: $0 [--pre-register] <email> [display name]" >&2
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
  if [ "$PRE_REGISTER" != true ]; then
    echo "ERROR: no account for $NORMALISED in $DB" >&2
    echo "       She signs in once and then this works. To create the row now:" >&2
    echo "         $0 --pre-register $NORMALISED \"Her Name\"" >&2
    echo "       Existing accounts:" >&2
    sqlite3 "$DB" "select '         ' || email || ' (' || role || ')' from users order by id;" >&2
    exit 1
  fi

  case "$NORMALISED" in
    *@gmail.com) ;;
    *)
      echo "WARNING: $NORMALISED is not a @gmail.com address." >&2
      echo "         Pre-registration only works when Google is authoritative for the address," >&2
      echo "         which covers @gmail.com and Google Workspace domains. Otherwise her Google" >&2
      echo "         sign-in will be refused as a conflict and she will not be able to get in at" >&2
      echo "         all. Check before doing this." >&2
      ;;
  esac

  # Local part as a fallback, so the row is never empty; the caller should pass a real name.
  NAME="${DISPLAY_NAME:-$(printf '%s' "${NORMALISED%%@*}" | sed 's/[._]/ /g')}"
  sqlite3 "$DB" "insert into users (email, display_name, role) values ('$NORMALISED', '$(printf '%s' "$NAME" | sed "s/'/''/g")', 'ADMIN');"
  echo "$NORMALISED: created as ADMIN, display name '$NAME' (in $DB)"
  echo "Her first Google sign-in will adopt this account rather than creating a second one."
  exit 0
fi

if [ -z "$DISPLAY_NAME" ] && [ "$PRE_REGISTER" = true ]; then
  echo "note: $NORMALISED already exists (as $EXISTING_ROLE); --pre-register had nothing to create." >&2
fi

if [ "$EXISTING_ROLE" = "ADMIN" ]; then
  echo "$NORMALISED is already ADMIN. Nothing to do."
  exit 0
fi

sqlite3 "$DB" "update users set role = 'ADMIN' where lower(email) = '$NORMALISED';"
echo "$NORMALISED: $EXISTING_ROLE -> ADMIN (in $DB)"
echo "Takes effect on her next request; no re-login needed."
