# Deployment Guide: staging and production with Cloudflare Tunnel

DBIT PageCraft runs as a Docker Compose stack per environment on one server. Cloudflare Tunnel exposes each environment, so the server needs **no public inbound ports** except SSH (and even SSH can go through Cloudflare Access).

```
Internet -> Cloudflare edge -> cloudflared (host service or container) -> nginx -> app (Node) -> db (PostgreSQL)
                 TLS ends here      outbound only                     :80     :3000        :5432
```

## 1. Ports

| Service | Container port | Host binding (default) | Public? |
|---------|----------------|------------------------|---------|
| nginx | 80 | `127.0.0.1:HTTP_PORT` (staging 8091, production 8090) | No. The host cloudflared reaches `http://localhost:HTTP_PORT`; a cloudflared container reaches `http://nginx:80` |
| app (Node.js) | 3000 | `127.0.0.1:APP_PORT` (staging 3091, production 3090) | No. Debug access only |
| db (PostgreSQL) | 5432 | none | No. Internal network only |
| cloudflared | none | none (host service uses 127.0.0.1:20241 for metrics) | Outbound 443 to Cloudflare only |
| SSH (host) | 22 or custom | host | Only if not using Cloudflare Access |

Direct TLS exposure (no tunnel) is still possible with `docker-compose.tls.yml`, which binds nginx to `0.0.0.0:80/443`. It is not used in the tunnel setup.

Check what is already listening on the server before choosing ports:

```bash
sudo ss -tlnp
```

On the OSSC server (checked 2026-11-08) 8080, 8081, 8082, 8083, 8000, 9000, 9443, 6001, 6002, 4317, 4318, 676 and 677 are already used by other containers, so PageCraft uses 8090/8091 and 3090/3091. SSH listens on 22 and a host-level `cloudflared` service is already running.

## 2. Server preparation (once)

```bash
# Docker Engine + Compose plugin (Ubuntu/Debian)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker deploy          # the SSH user used by GitHub Actions

# One directory per environment
sudo mkdir -p /opt/pagecraft/staging /opt/pagecraft/production
sudo chown -R deploy:deploy /opt/pagecraft
```

Create a dedicated SSH key for GitHub Actions and add the public half to the deploy user:

```bash
ssh-keygen -t ed25519 -C "github-actions pagecraft" -f pagecraft_deploy
cat pagecraft_deploy.pub >> /home/deploy/.ssh/authorized_keys
# pagecraft_deploy (private key) -> GitHub secret SSH_PRIVATE_KEY
```

Copy `.env.example` to each environment directory as `.env` and fill it in. Suggested values:

| Variable | staging | production |
|----------|---------|------------|
| `COMPOSE_PROJECT_NAME` | `pagecraft-staging` | `pagecraft-prod` |
| `APP_ENV` | `staging` | `production` |
| `COMPOSE_PROFILES` | empty (host cloudflared) or `tunnel` | empty (host cloudflared) or `tunnel` |
| `CF_TUNNEL_TOKEN` | only with the `tunnel` profile | only with the `tunnel` profile |
| `HTTP_PORT` / `APP_PORT` | `8091` / `3091` | `8090` / `3090` |
| `COOKIE_SECURE` | `true` | `true` |
| `POSTGRES_PASSWORD`, `ADMIN_PASSWORD`, `SESSION_SECRET` | unique random values | unique random values |

Everything else (compose file, nginx config, deploy script) is synced by the workflow on every deploy. `.env`, `nginx/certs/` and `nginx/conf.d/tls.conf` are never overwritten.

## 3. Cloudflare Tunnel

Two ways to connect the environments. Pick one per environment; do not mix them for the same hostname.

### Option A: existing host-level cloudflared (recommended on the OSSC server)

The server already runs `cloudflared` as a system service with its own tunnel. Add the two sites as public hostnames of that tunnel; nothing else has to run.

1. Cloudflare Zero Trust > Networks > Tunnels > the existing tunnel > **Public Hostname** > Add.
2. Staging: hostname `staging.<your-domain>`, service **HTTP**, URL `localhost:8091`.
3. Production: hostname `<your-domain>`, service **HTTP**, URL `localhost:8090`.
4. Leave `COMPOSE_PROFILES` and `CF_TUNNEL_TOKEN` empty in both `.env` files.

If the tunnel is managed from a config file instead of the dashboard, add the equivalent ingress rules to `/etc/cloudflared/config.yml` and restart the service:

```yaml
ingress:
  - hostname: staging.<your-domain>
    service: http://localhost:8091
  - hostname: <your-domain>
    service: http://localhost:8090
  # ... existing rules, then the final catch-all
  - service: http_status:404
```

### Option B: one cloudflared container per environment

Use this when the stack must be self-contained (another server, no host cloudflared).

1. Cloudflare Zero Trust > Networks > Tunnels > **Create a tunnel** (Cloudflared) and name it `pagecraft-staging`.
2. Copy the connector token into that environment's `.env` as `CF_TUNNEL_TOKEN` and set `COMPOSE_PROFILES=tunnel`. Ignore the install instructions; the `cloudflared` compose service runs it.
3. **Public Hostname** tab: add `staging.<your-domain>` with service **HTTP** and URL `nginx:80`.
4. Repeat for `pagecraft-prod` with the production hostname.

Recommended Cloudflare settings for the hostnames in both options: SSL/TLS mode Full, Always Use HTTPS on, and an Access policy in front of `/admin` if you want a second login layer.

In both options traffic reaches nginx from a private address (the Docker bridge gateway for the host service, the cloudflared container otherwise). nginx restores the visitor's IP from `CF-Connecting-IP` and forwards the original `https` scheme, so rate limits and the Secure cookie flag work as if the app were public.

## 4. GitHub configuration

Settings > Environments: create **staging** and **production**. For production, enable **Required reviewers** so a push to `master` waits for approval before deploying.

Secrets (per environment):

| Secret | Value |
|--------|-------|
| `SSH_HOST` | server hostname or IP (or the Cloudflare Access SSH hostname) |
| `SSH_USER` | `deploy` |
| `SSH_PRIVATE_KEY` | contents of `pagecraft_deploy` |
| `SSH_PORT` | optional, default `22` |
| `DEPLOY_PATH` | `/opt/pagecraft/staging` or `/opt/pagecraft/production` |
| `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET` | optional: Cloudflare Access service token when SSH is published through the tunnel instead of a public port. On the OSSC server SSH logins arrive from 127.0.0.1, which means SSH already goes through cloudflared, so set these and use the SSH hostname of the tunnel as `SSH_HOST` |

Variables (per environment):

| Variable | Value |
|----------|-------|
| `PUBLIC_HOST` | `staging.your-domain` / `your-domain`, used for the post-deploy smoke test and the environment URL |

Container images are pushed to `ghcr.io/ossc-dbit/dbit-pagecraft`. The first push creates the package as private; the workflow logs the server into GHCR with the job token, so it works either way. To let anyone pull it, set the package to public under the organisation's Packages settings.

## 5. Workflows

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| `ci.yml` | pull requests | syntax check, dash check, Docker build, `nginx -t`, compose validation |
| `deploy.yml` | push to `dev` | build image tagged with the commit sha and `staging`, deploy to staging, smoke test |
| `deploy.yml` | push to `master` | same, tagged `production` and `latest`, deploy to production (after approval if configured) |
| `deploy.yml` | manual run | choose the environment; give an existing sha as `image_tag` to redeploy or roll back without building |

Branch flow: work on feature branches, open PRs into `dev` (CI runs), merge to `dev` to test on staging, then open a PR from `dev` to `master` for production.

The deploy job syncs the compose and nginx files, runs `deploy/deploy.sh` on the server, waits for the app health check, verifies `/api/health` reports the deployed version through nginx, and finally checks the public hostname through Cloudflare.

## 6. Manual operations on the server

```bash
cd /opt/pagecraft/production

docker compose ps                          # status and health
docker compose logs -f app                 # application logs
docker compose logs -f cloudflared         # tunnel connector (container option only)
sudo journalctl -u cloudflared -f          # tunnel connector (host service option)
curl -s http://127.0.0.1:8090/api/health   # local health, production (shows env + version)
curl -s http://127.0.0.1:8091/api/health   # local health, staging

# Deploy or roll back to a specific build without GitHub
APP_IMAGE=ghcr.io/ossc-dbit/dbit-pagecraft:<git-sha> ./deploy/deploy.sh

# Database backup / restore
docker compose exec -T db pg_dump -U pagecraft pagecraft > backup_$(date +%F).sql
cat backup_2026-11-08.sql | docker compose exec -T db psql -U pagecraft -d pagecraft

# Clear analytics (for example after testing on staging)
docker compose exec -T db psql -U pagecraft -d pagecraft -c "truncate generations restart identity;"
```

## 7. Troubleshooting

- **Deploy fails at "waiting for app health"**: `docker compose logs app`. Usually a missing `.env` value (the compose file refuses to start without `POSTGRES_PASSWORD`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SESSION_SECRET`).
- **Smoke test fails but local health passes**: the tunnel hostname points at the wrong target (host service: `localhost:8090` or `localhost:8091`; container: `nginx:80`), or `CF_TUNNEL_TOKEN` belongs to the other environment. Check `sudo journalctl -u cloudflared` or `docker compose logs cloudflared`.
- **Admin login works locally but not through Cloudflare**: `COOKIE_SECURE` is `false` while the site is HTTPS, or the clock on the server is far off (session tokens carry an expiry).
- **Everyone hits 429**: nginx is not seeing real client IPs. Confirm requests arrive via cloudflared (which sets `CF-Connecting-IP`) and that the Docker network is in a private range covered by `set_real_ip_from` in `nginx/nginx.conf`.
