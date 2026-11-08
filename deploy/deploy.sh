#!/usr/bin/env bash
# Deploy one PageCraft environment on this server from the checked-out commit.
#
#   deploy/deploy.sh <staging|production> <git-sha>
#
# Run by the self-hosted GitHub Actions runner (.github/workflows/deploy.yml), or by hand
# from a checkout of the commit to deploy. It never deletes data:
#   1. reads /etc/pagecraft/<env>.conf (project name, env file, health URL)
#   2. builds the app image tagged <env>-<sha>, so staging and production never share one
#   3. starts the stack; the app runs its own schema migration on start-up
#   4. waits for the app and nginx to be healthy and checks the health URL reports the tag
#   5. records the deployed tag, so deploy/rollback.sh can return to the previous one
# On failure it prints the logs and stops.
set -euo pipefail

ENVIRONMENT="${1:-}"
SHA="${2:-}"
case "$ENVIRONMENT" in
  staging|production) ;;
  *) echo "usage: $0 <staging|production> <git-sha>" >&2; exit 2 ;;
esac
[[ "$SHA" =~ ^[0-9a-f]{7,40}$ ]] || { echo "error: '$SHA' is not a git commit SHA" >&2; exit 2; }

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONF="${PAGECRAFT_CONF_DIR:-/etc/pagecraft}/${ENVIRONMENT}.conf"
STATE_DIR="${PAGECRAFT_DEPLOY_STATE_DIR:-/var/lib/pagecraft-deploy}"
KEEP_IMAGES="${PAGECRAFT_KEEP_IMAGES:-5}"

log() { printf '[deploy %s %s] %s\n' "$ENVIRONMENT" "$(date -u +%H:%M:%S)" "$*"; }
die() { printf '[deploy %s] error: %s\n' "$ENVIRONMENT" "$*" >&2; exit 1; }

# ---------- configuration ----------
# Read KEY=value lines; never execute the file. It must be writable by root only, because it
# decides which env file and project a root-equivalent Docker command acts on.
[ -r "$CONF" ] || die "$CONF not found or not readable. Run: sudo bash deploy/setup-environment.sh $ENVIRONMENT"
if [ "${PAGECRAFT_DEPLOY_SKIP_OWNER_CHECK:-}" != 1 ]; then
  [ "$(stat -c %u "$CONF")" = 0 ] || die "$CONF must be owned by root"
  perms="$(stat -c %a "$CONF")"
  (( (8#$perms & 8#022) == 0 )) || die "$CONF must not be writable by group or others (chmod 644)"
fi
conf() { grep -E "^$1=" "$CONF" | tail -n1 | cut -d= -f2- | sed -e 's/^["'"'"']//' -e 's/["'"'"']$//' || true; }
PROJECT="$(conf PAGECRAFT_PROJECT)"
ENV_FILE="$(conf PAGECRAFT_ENV_FILE)"
HEALTH_URL="$(conf PAGECRAFT_HEALTH_URL)"
[ -n "$PROJECT" ] || die "set PAGECRAFT_PROJECT in $CONF"
[ -n "$ENV_FILE" ] || die "set PAGECRAFT_ENV_FILE in $CONF"
[ -n "$HEALTH_URL" ] || die "set PAGECRAFT_HEALTH_URL in $CONF"
[[ "$PROJECT" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || die "PAGECRAFT_PROJECT must be lowercase letters, digits, - or _"
[[ "$ENV_FILE" == /* ]] || die "PAGECRAFT_ENV_FILE must be an absolute path"
[[ "$HEALTH_URL" =~ ^https?://(127\.0\.0\.1|localhost)(:[0-9]+)?/ ]] || die "PAGECRAFT_HEALTH_URL must point at this server (127.0.0.1)"
if [ ! -e "$ENV_FILE" ]; then
  die "env file $ENV_FILE does not exist. Run: sudo bash deploy/setup-environment.sh $ENVIRONMENT"
elif [ ! -r "$ENV_FILE" ]; then
  # The file is root:pagecraft 640. A running runner keeps the groups it started with, so after
  # setup-environment.sh adds gh-runner to pagecraft the runner service must be restarted once.
  die "env file $ENV_FILE is not readable by $(id -un) (groups: $(id -Gn)). It must be group pagecraft, mode 640, and the runner must be in group pagecraft: sudo usermod -aG pagecraft $(id -un), then restart the runner service and re-run this job"
fi

# The env file must belong to this environment: a staging file under the production
# conf would start production on staging's ports with staging's database password.
envval() { grep -E "^$1=" "$ENV_FILE" | tail -n1 | cut -d= -f2- | tr -d '"'"'" || true; }
file_env="$(envval APP_ENV)"
[ "$file_env" = "$ENVIRONMENT" ] || die "$ENV_FILE has APP_ENV=${file_env:-unset}; it must be APP_ENV=$ENVIRONMENT. Fix the file (see deploy/setup-environment.sh) and re-run"
file_port="$(envval HTTP_PORT)"
health_port="$(printf '%s' "$HEALTH_URL" | sed -nE 's#^https?://[^:/]+:([0-9]+)/.*#\1#p')"
[ -z "$health_port" ] || [ "$file_port" = "$health_port" ] || die "$ENV_FILE has HTTP_PORT=${file_port:-unset} but $CONF checks port $health_port; make them match"
case "$ENVIRONMENT" in
  staging)    other_project="pagecraft-prod" ;;
  production) other_project="pagecraft-staging" ;;
esac
[ "$PROJECT" != "$other_project" ] || die "$CONF names project $PROJECT, which belongs to the other environment"

mkdir -p "$STATE_DIR"
exec 9>"$STATE_DIR/${ENVIRONMENT}.lock"
if command -v flock >/dev/null; then
  flock -n 9 || die "another deploy of $ENVIRONMENT is running"
fi

TAG="${ENVIRONMENT}-${SHA:0:12}"
export APP_IMAGE="pagecraft-app:${TAG}"
export APP_VERSION="$TAG"
dc() { docker compose -p "$PROJECT" -f "$REPO_DIR/docker-compose.yml" --env-file "$ENV_FILE" "$@"; }

cd "$REPO_DIR"
log "commit $SHA, project $PROJECT, image $APP_IMAGE"
dc config --quiet || die "docker-compose.yml with $ENV_FILE is not valid"

# ---------- build ----------
log "building the app image"
dc build --pull app

previous="$(cat "$STATE_DIR/${ENVIRONMENT}.current" 2>/dev/null || true)"

container() { dc ps -aq "$1" | head -n1; }
wait_healthy() {
  local service="$1" deadline=$((SECONDS + ${2:-300})) id status
  while (( SECONDS < deadline )); do
    id="$(container "$service")"
    if [ -n "$id" ]; then
      status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id")"
      case "$status" in
        healthy) return 0 ;;
        unhealthy|exited|dead) return 1 ;;
      esac
    fi
    sleep 5
  done
  return 1
}
fail() {
  log "deploy FAILED: $1"
  dc ps -a || true
  dc logs --tail 80 app nginx || true
  [ -n "$previous" ] && log "previous release: $previous. Roll back with: deploy/rollback.sh $ENVIRONMENT"
  exit 1
}

# ---------- start ----------
log "starting the database"
dc up -d --wait db || fail "the database did not become healthy"

log "starting the new release (the app migrates the schema on start-up)"
dc up -d --remove-orphans db app nginx || fail "docker compose up failed"
wait_healthy app 240 || fail "app did not become healthy"
wait_healthy nginx 120 || fail "nginx did not become healthy"

body="$(curl -fsS --max-time 10 "$HEALTH_URL" || true)"
echo "$body"
case "$body" in
  *"\"version\":\"${TAG}\""*) ;;
  *) fail "$HEALTH_URL did not report version $TAG" ;;
esac

# ---------- record and tidy ----------
[ -n "$previous" ] && [ "$previous" != "$TAG" ] && echo "$previous" > "$STATE_DIR/${ENVIRONMENT}.previous"
echo "$TAG" > "$STATE_DIR/${ENVIRONMENT}.current"
printf '%s %s %s\n' "$(date -u +%FT%TZ)" "$TAG" "$SHA" >> "$STATE_DIR/${ENVIRONMENT}.history"

# Keep the newest images of this environment (the current one, and earlier ones to roll back to).
docker image ls pagecraft-app --format '{{.CreatedAt}}\t{{.Tag}}' \
  | { grep -E $'\t'"${ENVIRONMENT}-" || true; } | sort -r | tail -n +"$((KEEP_IMAGES + 1))" | cut -f2 \
  | while read -r old; do
      [ "$old" = "$TAG" ] || docker image rm "pagecraft-app:$old" >/dev/null 2>&1 || true
    done
docker image prune -f >/dev/null 2>&1 || true

log "deployed $TAG and healthy"
