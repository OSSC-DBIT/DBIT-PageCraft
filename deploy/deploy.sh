#!/usr/bin/env bash
# deploy/deploy.sh - runs ON THE SERVER inside an environment directory
# (e.g. /srv/server-data/staging). Called by .github/workflows/deploy.yml over SSH,
# or by hand for a manual deploy / rollback:
#
#   APP_IMAGE=ghcr.io/ossc-dbit/dbit-pagecraft:<git-sha> ./deploy/deploy.sh
#
# Optional: GHCR_USER / GHCR_TOKEN to log in to GHCR when the package is private.
# Requires: .env in the same directory (copied once from .env.example).
set -euo pipefail

cd "$(dirname "$0")/.."

log() { printf '[deploy] %s\n' "$*"; }

[ -f .env ] || { log "ERROR: .env not found in $(pwd). Copy .env.example and fill it in."; exit 1; }
: "${APP_IMAGE:?APP_IMAGE is required, e.g. ghcr.io/ossc-dbit/dbit-pagecraft:<sha>}"
APP_VERSION="${APP_VERSION:-${APP_IMAGE##*:}}"

# Insert or update KEY=VALUE in .env
upsert() {
  local key="$1" val="$2"
  if grep -q "^${key}=" .env; then
    sed -i "s|^${key}=.*|${key}=${val}|" .env
  else
    printf '\n%s=%s\n' "$key" "$val" >> .env
  fi
}
upsert APP_IMAGE   "$APP_IMAGE"
upsert APP_VERSION "$APP_VERSION"

PROJECT="$(grep -E '^COMPOSE_PROJECT_NAME=' .env | cut -d= -f2- || true)"
HTTP_PORT="$(grep -E '^HTTP_PORT=' .env | cut -d= -f2- || true)"
HTTP_PORT="${HTTP_PORT:-8090}"
log "project=${PROJECT:-default} image=${APP_IMAGE} version=${APP_VERSION}"

if [ -n "${GHCR_TOKEN:-}" ]; then
  log "logging in to ghcr.io"
  printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "${GHCR_USER:-github}" --password-stdin >/dev/null
fi

# A failed pull is not fatal by itself (e.g. local image during a manual deploy);
# the version check at the end guarantees the requested build is what runs.
log "pulling images"
docker compose pull --quiet || log "WARNING: pull failed, continuing with local images"

log "starting containers"
docker compose up -d --no-build --remove-orphans

log "waiting for app health"
status=""
for _ in $(seq 1 40); do
  status="$(docker compose ps --format '{{.Health}}' app 2>/dev/null || true)"
  [ "$status" = "healthy" ] && break
  sleep 3
done
if [ "$status" != "healthy" ]; then
  log "ERROR: app did not become healthy (status: ${status:-unknown})"
  docker compose logs --tail=80 app
  exit 1
fi

log "health check through nginx (127.0.0.1:${HTTP_PORT})"
health="$(curl -fsS "http://127.0.0.1:${HTTP_PORT}/api/health")"
echo "$health"
case "$health" in
  *"\"version\":\"${APP_VERSION}\""*) ;;
  *) log "ERROR: running version does not match ${APP_VERSION}"; exit 1 ;;
esac

docker image prune -f >/dev/null || true
docker logout ghcr.io >/dev/null 2>&1 || true
log "done"
