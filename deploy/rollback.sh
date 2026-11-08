#!/usr/bin/env bash
# Return one PageCraft environment to the release before the current one, without building.
#
#   deploy/rollback.sh <staging|production> [tag]
#
# Uses the images kept by deploy.sh (tag <env>-<sha>). With no tag, it uses the previous
# release recorded in /var/lib/pagecraft-deploy/<env>.previous; `docker image ls pagecraft-app`
# lists what is available. The database is left as it is (the schema only ever gains
# columns and tables, old releases keep working against it).
set -euo pipefail

ENVIRONMENT="${1:-}"
case "$ENVIRONMENT" in
  staging|production) ;;
  *) echo "usage: $0 <staging|production> [tag]" >&2; exit 2 ;;
esac
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="${PAGECRAFT_DEPLOY_STATE_DIR:-/var/lib/pagecraft-deploy}"
CONF="${PAGECRAFT_CONF_DIR:-/etc/pagecraft}/${ENVIRONMENT}.conf"
[ -r "$CONF" ] || { echo "error: $CONF not found" >&2; exit 1; }
conf() { grep -E "^$1=" "$CONF" | tail -n1 | cut -d= -f2- | sed -e 's/^["'"'"']//' -e 's/["'"'"']$//' || true; }
PROJECT="$(conf PAGECRAFT_PROJECT)"
ENV_FILE="$(conf PAGECRAFT_ENV_FILE)"
HEALTH_URL="$(conf PAGECRAFT_HEALTH_URL)"
[[ "$PROJECT" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || { echo "error: bad PAGECRAFT_PROJECT in $CONF" >&2; exit 1; }

TAG="${2:-$(cat "$STATE_DIR/${ENVIRONMENT}.previous" 2>/dev/null || true)}"
[ -n "$TAG" ] || { echo "error: no previous release recorded; pass a tag" >&2; exit 1; }
[[ "$TAG" == "${ENVIRONMENT}-"* ]] || { echo "error: tag '$TAG' is not a $ENVIRONMENT release" >&2; exit 1; }
docker image inspect "pagecraft-app:$TAG" >/dev/null 2>&1 || { echo "error: image pagecraft-app:$TAG is not on this server" >&2; exit 1; }

mkdir -p "$STATE_DIR"
exec 9>"$STATE_DIR/${ENVIRONMENT}.lock"
if command -v flock >/dev/null; then
  flock -n 9 || { echo "error: a deploy of $ENVIRONMENT is running" >&2; exit 1; }
fi

export APP_IMAGE="pagecraft-app:$TAG" APP_VERSION="$TAG"
dc() { docker compose -p "$PROJECT" -f "$REPO_DIR/docker-compose.yml" --env-file "$ENV_FILE" "$@"; }

cd "$REPO_DIR"
echo "[rollback $ENVIRONMENT] starting $TAG"
dc up -d --no-build --remove-orphans db app nginx
for _ in $(seq 1 48); do
  body="$(curl -fsS --max-time 5 "$HEALTH_URL" 2>/dev/null || true)"
  case "$body" in *"\"version\":\"${TAG}\""*) break ;; esac
  sleep 5
done
case "$body" in
  *"\"version\":\"${TAG}\""*) ;;
  *) echo "[rollback $ENVIRONMENT] error: $HEALTH_URL does not report $TAG" >&2; dc logs --tail 60 app nginx || true; exit 1 ;;
esac

current="$(cat "$STATE_DIR/${ENVIRONMENT}.current" 2>/dev/null || true)"
[ -n "$current" ] && [ "$current" != "$TAG" ] && echo "$current" > "$STATE_DIR/${ENVIRONMENT}.previous"
echo "$TAG" > "$STATE_DIR/${ENVIRONMENT}.current"
printf '%s %s rollback\n' "$(date -u +%FT%TZ)" "$TAG" >> "$STATE_DIR/${ENVIRONMENT}.history"
echo "[rollback $ENVIRONMENT] running $TAG"
