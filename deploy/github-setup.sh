#!/usr/bin/env bash
# deploy/github-setup.sh - configure the GitHub side of the pipeline from your
# own machine with the gh CLI (needs admin on the repo, `gh auth login` done).
#
# Creates/updates the "staging" and "Production" environments, their secrets
# and variables, branch policies, a required reviewer for Production, and
# removes the Vercel/Supabase leftovers (Preview environment, SUPABASE secret).
#
#   SSH_HOST=ssh.example.com STAGING_HOST=staging.example.com PROD_HOST=pagecraft.example.com \
#   CF_ACCESS_CLIENT_ID=... CF_ACCESS_CLIENT_SECRET=... \
#   bash deploy/github-setup.sh ~/.ssh/pagecraft_deploy
#
# Anything not given in the environment is asked for interactively.
set -euo pipefail

REPO="${REPO:-OSSC-DBIT/DBIT-PageCraft}"
KEY_FILE="${1:-}"
SSH_USER="${SSH_USER:-dbit-oscc}"
STAGING_PATH="${STAGING_PATH:-/srv/server-data/staging}"
PROD_PATH="${PROD_PATH:-/srv/server-data/production}"

log() { printf '[gh-setup] %s\n' "$*"; }
ask() { # ask VAR "prompt" [secret]
  local var="$1" prompt="$2" secret="${3:-}"
  if [ -z "${!var:-}" ]; then
    if [ -n "$secret" ]; then read -r -s -p "$prompt: " "$var"; echo; else read -r -p "$prompt: " "$var"; fi
  fi
}

command -v gh >/dev/null || { log "ERROR: gh CLI not installed (https://cli.github.com)"; exit 1; }
gh auth status >/dev/null 2>&1 || { log "ERROR: run 'gh auth login' first"; exit 1; }

[ -n "$KEY_FILE" ] || { log "usage: $0 <path to private deploy key>"; exit 1; }
[ -f "$KEY_FILE" ] || { log "ERROR: $KEY_FILE not found. Create it with: ssh-keygen -t ed25519 -N '' -C github-actions -f $KEY_FILE"; exit 1; }

ask SSH_HOST "SSH hostname GitHub Actions should connect to (Cloudflare Access SSH hostname or IP)"
ask STAGING_HOST "Public hostname for staging (e.g. staging.example.com)"
ask PROD_HOST "Public hostname for production (e.g. pagecraft.example.com)"
ask CF_ACCESS_CLIENT_ID "Cloudflare Access service token ID (leave empty if SSH is a public port)"
if [ -n "${CF_ACCESS_CLIENT_ID:-}" ]; then ask CF_ACCESS_CLIENT_SECRET "Cloudflare Access service token secret" secret; fi

uid="$(gh api user --jq .id)"
login="$(gh api user --jq .login)"

configure_env() { # name deploy_path public_host branch
  local env="$1" path="$2" host="$3" branch="$4"
  log "environment $env"
  printf '{"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}' \
    | gh api -X PUT "repos/$REPO/environments/$env" --input - >/dev/null
  if ! gh api "repos/$REPO/environments/$env/deployment-branch-policies" --jq '.branch_policies[].name' | grep -qx "$branch"; then
    gh api -X POST "repos/$REPO/environments/$env/deployment-branch-policies" -f name="$branch" >/dev/null
  fi
  gh secret set SSH_HOST        -R "$REPO" -e "$env" -b "$SSH_HOST"
  gh secret set SSH_USER        -R "$REPO" -e "$env" -b "$SSH_USER"
  gh secret set DEPLOY_PATH     -R "$REPO" -e "$env" -b "$path"
  gh secret set SSH_PRIVATE_KEY -R "$REPO" -e "$env" < "$KEY_FILE"
  if [ -n "${CF_ACCESS_CLIENT_ID:-}" ]; then
    gh secret set CF_ACCESS_CLIENT_ID     -R "$REPO" -e "$env" -b "$CF_ACCESS_CLIENT_ID"
    gh secret set CF_ACCESS_CLIENT_SECRET -R "$REPO" -e "$env" -b "$CF_ACCESS_CLIENT_SECRET"
  fi
  gh variable set PUBLIC_HOST -R "$REPO" -e "$env" -b "$host"
}

configure_env staging    "$STAGING_PATH" "$STAGING_HOST" dev
configure_env Production "$PROD_PATH"    "$PROD_HOST"    master

log "Production: require approval from $login before each deploy"
printf '{"reviewers":[{"type":"User","id":%s}],"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}' "$uid" \
  | gh api -X PUT "repos/$REPO/environments/Production" --input - >/dev/null

log "removing Vercel/Supabase leftovers"
gh api -X DELETE "repos/$REPO/environments/Preview" >/dev/null 2>&1 && log "deleted environment Preview" || true
gh secret delete SUPABASE_PROJECTS_JSON -R "$REPO" >/dev/null 2>&1 && log "deleted repo secret SUPABASE_PROJECTS_JSON" || true

log "summary"
for env in staging Production; do
  printf '  %-10s secrets: %s  vars: %s\n' "$env" \
    "$(gh api "repos/$REPO/environments/$env/secrets" --jq '[.secrets[].name] | join(",")')" \
    "$(gh api "repos/$REPO/environments/$env/variables" --jq '[.variables[] | "\(.name)=\(.value)"] | join(",")')"
done
log "done. Trigger a deploy with:  gh workflow run deploy.yml -R $REPO -f environment=staging"
