#!/usr/bin/env bash
#
# One-time host setup for the Real Maths deployment target. Safe to re-run.
#
#   SITE_ADDRESS=http://1.2.3.4 \
#   GHCR_OWNER=katesant GHCR_REPO=real-maths \
#     ssh -i <private-key> ubuntu@<static-ip> 'bash -s' < scripts/bootstrap-host.sh
#
# SITE_ADDRESS is the Caddy site address and includes the scheme. A bare hostname
# makes Caddy request a certificate; http:// serves plain HTTP. A bare IP cannot get
# a publicly trusted certificate at all, so use http:// for one.
#
# Installs Docker with the Compose plugin and writes /srv/realmaths/.env. It does
# not start the app: that is the deploy workflow's job, so that the first thing to
# serve traffic is a real build rather than an empty shell.

set -euo pipefail

SITE_ADDRESS="${SITE_ADDRESS:?set SITE_ADDRESS, for example http://1.2.3.4 or https://realmaths.example.com}"
GHCR_OWNER="${GHCR_OWNER:?set GHCR_OWNER, the lowercase GitHub owner, e.g. katesant}"
GHCR_REPO="${GHCR_REPO:?set GHCR_REPO, e.g. real-maths}"
APP_DIR=/srv/realmaths

echo "==> Installing Docker"
if command -v docker >/dev/null 2>&1; then
  echo "    already installed ($(docker --version))"
else
  # Docker's convenience script includes the compose plugin, which is separate
  # from the docker package in Ubuntu's own repositories.
  curl -fsSL https://get.docker.com | sudo sh
fi
sudo docker compose version >/dev/null
echo "    compose plugin present"

# Lets the ubuntu user run docker directly, which is what the deploy workflow
# relies on. Group changes only apply to NEW sessions, so an SSH connection
# established before this ran will still need sudo.
if ! id -nG "$USER" | grep -qw docker; then
  echo "==> Adding $USER to the docker group"
  sudo usermod -aG docker "$USER"
  echo "    applies from your next login"
fi

sudo systemctl enable --now docker >/dev/null

echo "==> Preparing $APP_DIR"
sudo mkdir -p "$APP_DIR"
# The deploy workflow runs as this user: it scps the compose file and Caddyfile in,
# and reads .env. Root-owned files here do not fail at bootstrap time, they fail as
# "Permission denied" on the first deploy, which is a much more confusing place.
sudo chown "$USER:$USER" "$APP_DIR"
echo "    owned by $USER"

# The signing secret must survive re-runs: rotating it silently invalidates every
# issued token and logs all users out.
EXISTING_SECRET=""
if sudo test -f "$APP_DIR/.env"; then
  EXISTING_SECRET="$(sudo grep -E '^REALMATHS_JWT_SECRET=' "$APP_DIR/.env" | cut -d= -f2- || true)"
fi

if [ -n "$EXISTING_SECRET" ]; then
  SECRET="$EXISTING_SECRET"
  echo "    reusing the existing JWT secret"
else
  # 32 bytes as hex: no characters that need quoting or escaping in an env file.
  SECRET="$(openssl rand -hex 32)"
  echo "    generated a new JWT secret"
fi

# The image names must be real rather than placeholders: Compose validates them even
# when the deploy workflow overrides them, and a placeholder like CHANGEME fails with
# "invalid reference format: repository name must be lowercase", which makes every
# manual `docker compose` command on the host unusable. The workflow records the
# deployed commit sha here on each release.
sudo tee "$APP_DIR/.env" >/dev/null <<EOF
SITE_ADDRESS=$SITE_ADDRESS
REALMATHS_JWT_SECRET=$SECRET
IMAGE_API=ghcr.io/$GHCR_OWNER/$GHCR_REPO/api:latest
IMAGE_WEB=ghcr.io/$GHCR_OWNER/$GHCR_REPO/web:latest
EOF
sudo chown "$USER:$USER" "$APP_DIR/.env"
sudo chmod 600 "$APP_DIR/.env"
echo "    wrote $APP_DIR/.env (mode 600, owned by $USER)"

cat <<'EOF'

==> Done.

Not done for you, deliberately:

  * The Lightsail firewall is the network boundary. There is no need for ufw as
    well, and enabling it can lock you out of the very port you are using.

  * Consider unattended security upgrades on a public host:
      sudo apt-get install -y unattended-upgrades

Next: set SITE_ADDRESS and the DEPLOY_* secrets in GitHub, then push to main.
EOF
