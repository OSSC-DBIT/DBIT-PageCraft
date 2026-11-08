#!/usr/bin/env bash
# Prepare one PageCraft environment on the OSSC server, in one command. Safe to run again.
#
#   sudo bash deploy/setup-environment.sh staging    [--domain dbit-pagecraft-staging.webuildnow.in]
#   sudo bash deploy/setup-environment.sh production [--domain dbit-pagecraft.webuildnow.in]
#
# It never overwrites a secret that is already set. It does:
#   - the `pagecraft` group, and adds the GitHub runner user (gh-runner) to it
#   - folders: /srv/server-data/<env>/pagecraft/ (root:pagecraft 750)
#   - the env file pagecraft.env (root:pagecraft 640) with fresh secrets and this
#     environment's ports, or completes an existing one
#   - /etc/pagecraft/<env>.conf for continuous deployment (no secrets: where things are)
#   - /var/lib/pagecraft-deploy owned by the runner, and the `pagecraft` helper command
# Same layout as PCMS on this server (see its docs/SERVER.md). Guide: docs/DEPLOYMENT.md.
set -euo pipefail

ENVIRONMENT="${1:-}"; shift || true
DOMAIN=""
while [ $# -gt 0 ]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    *) echo "unknown option $1" >&2; exit 2 ;;
  esac
done

case "$ENVIRONMENT" in
  staging)
    PROJECT=pagecraft-staging; [ -n "$DOMAIN" ] || DOMAIN=dbit-pagecraft-staging.webuildnow.in
    HTTP_PORT=8091; APP_PORT=3091 ;;
  production)
    PROJECT=pagecraft-prod; [ -n "$DOMAIN" ] || DOMAIN=dbit-pagecraft.webuildnow.in
    HTTP_PORT=8090; APP_PORT=3090 ;;
  *) echo "usage: sudo bash $0 <staging|production> [--domain host]" >&2; exit 2 ;;
esac
DATA_DIR="/srv/server-data/$ENVIRONMENT/pagecraft"
ENV_FILE="$DATA_DIR/pagecraft.env"
RUNNER_USER="${RUNNER_USER:-gh-runner}"

[ "$(id -u)" = 0 ] || { echo "run with sudo" >&2; exit 1; }
command -v docker >/dev/null || { echo "docker is not installed" >&2; exit 1; }
command -v openssl >/dev/null || { echo "openssl is not installed" >&2; exit 1; }
command -v flock >/dev/null || { echo "flock is missing (apt-get install util-linux)" >&2; exit 1; }

say() { printf '\n== %s\n' "$*"; }
note() { printf '   %s\n' "$*"; }
STAMP="$(date +%Y%m%d-%H%M%S)"
random() { openssl rand -base64 "$1" | tr -d '/+=\n' | head -c "$2"; }

get() { grep -E "^$1=" "$ENV_FILE" 2>/dev/null | tail -n1 | cut -d= -f2- | sed -e 's/^["'"'"']//' -e 's/["'"'"']$//' || true; }
put() {
  local key="$1" value="$2" tmp
  tmp="$(mktemp)"
  grep -vE "^$key=" "$ENV_FILE" > "$tmp" || true
  printf '%s=%s\n' "$key" "$value" >> "$tmp"
  cat "$tmp" > "$ENV_FILE"; rm -f "$tmp"
}
put_if_empty() { [ -n "$(get "$1")" ] || { put "$1" "$2"; note "set $1"; }; }

# ---------- group and runner ----------
say "group pagecraft"
groupadd -f pagecraft
if id "$RUNNER_USER" >/dev/null 2>&1; then
  if ! id -nG "$RUNNER_USER" | tr ' ' '\n' | grep -qx pagecraft; then
    usermod -aG pagecraft "$RUNNER_USER"
    note "added $RUNNER_USER to group pagecraft"
    # A running process keeps the groups it started with: restart the runner(s) so deploys
    # can read the settings file. Without this the deploy fails with "not readable".
    if systemctl list-units --type=service --all 'actions.runner.*' --no-legend 2>/dev/null | grep -q .; then
      systemctl restart 'actions.runner.*' && note "restarted the GitHub runner service(s)"
    fi
  else
    note "$RUNNER_USER already in group pagecraft"
  fi
  id -nG "$RUNNER_USER" | tr ' ' '\n' | grep -qx docker || note "WARNING: $RUNNER_USER is not in the docker group (sudo usermod -aG docker $RUNNER_USER)"
else
  note "user $RUNNER_USER does not exist yet; install the runner (deploy/install-runner.sh) and run this again"
fi

# ---------- folders ----------
say "folders in $DATA_DIR"
install -d -m 755 /srv/server-data "/srv/server-data/$ENVIRONMENT"
install -d -m 750 -o root -g pagecraft "$DATA_DIR"
note "ok"

# ---------- env file ----------
say "settings file $ENV_FILE"
if [ ! -f "$ENV_FILE" ]; then
  ADMIN_PASSWORD="$(random 36 24)"
  install -m 640 -o root -g pagecraft /dev/null "$ENV_FILE"
  cat > "$ENV_FILE" <<EOF
# PageCraft $ENVIRONMENT settings. Created by deploy/setup-environment.sh on $(date -u +%F).
# Mode 640, root:pagecraft. Every setting is explained in .env.example in the repository.
# APP_IMAGE and APP_VERSION are set by deploy/deploy.sh for each release; do not put them here.

APP_ENV=$ENVIRONMENT
PUBLIC_URL=https://$DOMAIN

POSTGRES_DB=pagecraft
POSTGRES_USER=pagecraft
POSTGRES_PASSWORD=$(random 48 40)

ADMIN_EMAIL=admin@dbit.local
ADMIN_PASSWORD=$ADMIN_PASSWORD

SESSION_SECRET=$(random 96 64)
SESSION_HOURS=8

HTTP_BIND=127.0.0.1
HTTP_PORT=$HTTP_PORT
APP_PORT=$APP_PORT

TRUST_PROXY=1
COOKIE_SECURE=true
EOF
  note "created with a fresh database password, session secret and admin password"
  note "admin login: admin@dbit.local / $ADMIN_PASSWORD   <- store it; change ADMIN_EMAIL in the file if you like"
else
  cp -a "$ENV_FILE" "$ENV_FILE.bak-$STAMP"
  note "exists; backup: $ENV_FILE.bak-$STAMP"
  # APP_ENV is not a secret and must match this environment, so it is always corrected.
  [ "$(get APP_ENV)" = "$ENVIRONMENT" ] || { put APP_ENV "$ENVIRONMENT"; note "corrected APP_ENV=$ENVIRONMENT"; }
  put_if_empty PUBLIC_URL "https://$DOMAIN"
  put_if_empty HTTP_BIND 127.0.0.1
  put_if_empty HTTP_PORT "$HTTP_PORT"
  put_if_empty APP_PORT "$APP_PORT"
  for key in HTTP_PORT:$HTTP_PORT APP_PORT:$APP_PORT; do
    k="${key%%:*}"; want="${key##*:}"; have="$(get "$k")"
    [ "$have" = "$want" ] || note "WARNING: $k=$have differs from this environment's usual $want (the other environment uses the other pair). Edit $ENV_FILE if that is not intended and run this script again."
  done
  put_if_empty TRUST_PROXY 1
  put_if_empty COOKIE_SECURE true
  put_if_empty POSTGRES_DB pagecraft
  put_if_empty POSTGRES_USER pagecraft
  put_if_empty POSTGRES_PASSWORD "$(random 48 40)"
  put_if_empty SESSION_SECRET "$(random 96 64)"
  put_if_empty SESSION_HOURS 8
  put_if_empty ADMIN_EMAIL admin@dbit.local
  if [ -z "$(get ADMIN_PASSWORD)" ]; then p="$(random 36 24)"; put ADMIN_PASSWORD "$p"; note "set ADMIN_PASSWORD=$p (store it)"; fi
  # Release tags are per deploy, never pinned in the file.
  sed -i -E '/^(APP_IMAGE|APP_VERSION|COMPOSE_PROJECT_NAME|COMPOSE_PROFILES|CF_TUNNEL_TOKEN)=/d' "$ENV_FILE"
fi
chown root:pagecraft "$ENV_FILE"; chmod 640 "$ENV_FILE"
HTTP_PORT="$(get HTTP_PORT)"; APP_PORT="$(get APP_PORT)"

# ---------- continuous deployment ----------
say "/etc/pagecraft/$ENVIRONMENT.conf"
install -d -m 755 /etc/pagecraft
printf 'PAGECRAFT_PROJECT=%s\nPAGECRAFT_ENV_FILE=%s\nPAGECRAFT_HEALTH_URL=http://127.0.0.1:%s/api/health\n' \
  "$PROJECT" "$ENV_FILE" "$HTTP_PORT" > "/etc/pagecraft/$ENVIRONMENT.conf"
chown root:root "/etc/pagecraft/$ENVIRONMENT.conf"; chmod 644 "/etc/pagecraft/$ENVIRONMENT.conf"
if id "$RUNNER_USER" >/dev/null 2>&1; then
  install -d -o "$RUNNER_USER" -g "$RUNNER_USER" /var/lib/pagecraft-deploy
else
  install -d /var/lib/pagecraft-deploy
fi
note "project $PROJECT, health check on http://127.0.0.1:$HTTP_PORT/api/health"

# ---------- the `pagecraft` helper ----------
say "helper command: pagecraft"
cat > /usr/local/bin/pagecraft <<'HELPER'
#!/usr/bin/env bash
# pagecraft <staging|production> <command>   Day-to-day commands for a PageCraft environment.
#   status          release, container health, the health check, last deploys
#   logs [svc]      last 200 lines (app, nginx, db), follow with -f
#   psql            open the database
#   admin           show the admin login from the settings file
#   rollback [tag]  go back to the previous release
#   compose ...     any docker compose command for this environment
set -euo pipefail
ENVIRONMENT="${1:-}"; CMD="${2:-status}"; shift 2 2>/dev/null || shift $#
CONF="/etc/pagecraft/$ENVIRONMENT.conf"
[ -r "$CONF" ] || { echo "usage: pagecraft <staging|production> <status|logs|psql|admin|rollback|compose ...>" >&2; exit 2; }
conf() { grep -E "^$1=" "$CONF" | tail -n1 | cut -d= -f2-; }
PROJECT="$(conf PAGECRAFT_PROJECT)"; ENV_FILE="$(conf PAGECRAFT_ENV_FILE)"; HEALTH="$(conf PAGECRAFT_HEALTH_URL)"
REPO="$(ls -d /srv/actions-runner*/_work/DBIT-PageCraft/DBIT-PageCraft 2>/dev/null | head -n1 || true)"
[ -n "$REPO" ] && [ -f "$REPO/docker-compose.yml" ] || { echo "no runner checkout of DBIT-PageCraft found under /srv/actions-runner*" >&2; exit 1; }
TAG="$(cat "/var/lib/pagecraft-deploy/$ENVIRONMENT.current" 2>/dev/null || true)"
[ -n "$TAG" ] && export APP_IMAGE="pagecraft-app:$TAG" APP_VERSION="$TAG"
dc() { docker compose -p "$PROJECT" -f "$REPO/docker-compose.yml" --env-file "$ENV_FILE" "$@"; }
case "$CMD" in
  status)
    echo "environment: $ENVIRONMENT   project: $PROJECT   release: ${TAG:-not deployed by CD yet}"
    dc ps --format 'table {{.Service}}\t{{.Status}}'
    printf 'health: '; curl -fsS --max-time 10 "$HEALTH" && echo || echo "NOT OK ($HEALTH)"
    tail -n 5 "/var/lib/pagecraft-deploy/$ENVIRONMENT.history" 2>/dev/null | sed 's/^/deployed: /' || true ;;
  logs) dc logs --tail 200 "$@" ;;
  psql) dc exec db psql -U "$(grep -E '^POSTGRES_USER=' "$ENV_FILE" | cut -d= -f2-)" -d "$(grep -E '^POSTGRES_DB=' "$ENV_FILE" | cut -d= -f2-)" ;;
  admin) grep -E '^(ADMIN_EMAIL|ADMIN_PASSWORD|PUBLIC_URL)=' "$ENV_FILE" ;;
  rollback) bash "$REPO/deploy/rollback.sh" "$ENVIRONMENT" "$@" ;;
  compose) dc "$@" ;;
  *) echo "unknown command $CMD" >&2; exit 2 ;;
esac
HELPER
chmod 755 /usr/local/bin/pagecraft
note "try: sudo pagecraft $ENVIRONMENT status   (after the first deploy)"

# ---------- ports ----------
say "ports"
for port in "$HTTP_PORT" "$APP_PORT"; do
  owner="$(ss -ltnpH "sport = :$port" 2>/dev/null | head -n1 || true)"
  if [ -z "$owner" ]; then note "$port free"
  elif echo "$owner" | grep -q docker; then note "$port used by Docker (expected if $ENVIRONMENT is already running)"
  else note "WARNING: $port is used by: $owner"; fi
done

say "summary"
note "settings:    $ENV_FILE"
grep -E '^(APP_ENV|PUBLIC_URL|HTTP_PORT|APP_PORT|ADMIN_EMAIL)=' "$ENV_FILE" | sed 's/^/             /'
note "Cloudflare:  Zero Trust > Networks > Tunnels > the existing tunnel > Public hostname"
note "             $DOMAIN  ->  type HTTP, URL localhost:$HTTP_PORT"
if [ "$ENVIRONMENT" = production ]; then
  note "next:        push (or merge) to master on GitHub; the Deploy workflow deploys production"
else
  note "next:        push (or merge) to dev on GitHub; the Deploy workflow deploys staging"
fi
