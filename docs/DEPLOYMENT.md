# Deployment Guide: staging and production on the OSSC server

DBIT PageCraft runs as a Docker Compose stack per environment on the OSSC server, deployed the same way as PCMS: a push to GitHub runs CI, then a **self-hosted GitHub Actions runner on the server** builds and starts the release. Visitors arrive through the server's existing **Cloudflare Tunnel**. Nothing is exposed to the internet and GitHub holds no server secret.

```
push dev / master -> CI (GitHub runners) -> self-hosted runner on the server -> deploy/deploy.sh
                                                                                   |
Visitors -> Cloudflare edge -> cloudflared.service -> nginx :809x -> app :3000 -> db :5432
```

| Branch | Goes to | Hostname (Cloudflare) | nginx on the server | app (debug) |
|---|---|---|---|---|
| any pull request | nowhere, CI only | | | |
| `dev` | **staging** | `dbitpagecraft-staging.webuildnow.in` | `127.0.0.1:8091` | `127.0.0.1:3091` |
| `master` | **production** | `dbitpagecraft.webuildnow.in` | `127.0.0.1:8090` | `127.0.0.1:3090` |

The hostnames are the defaults in `deploy/setup-environment.sh` and `.github/workflows/deploy.yml`; change both if you use others.

## 1. Ports

| Service | Container port | Host binding | Public? |
|---|---|---|---|
| nginx | 80 | `127.0.0.1:HTTP_PORT` (staging 8091, production 8090) | No. The host `cloudflared` forwards the hostname to `localhost:HTTP_PORT` |
| app (Node.js) | 3000 | `127.0.0.1:APP_PORT` (staging 3091, production 3090) | No. Debug access only |
| db (PostgreSQL) | 5432 | none | No. Internal network only |

Already used on the OSSC server (checked 2026-11-08 with `sudo ss -tlnp`): 22 SSH, 676/677 and 8082/8083 PCMS, 8080 OSSC website, 8081, 8000/6001/6002 Coolify, 9000/9443 Portainer, 9090 Cockpit, 4317/4318 OpenTelemetry, 20128 OmniRoute. Add PageCraft's rows to the port table in the PCMS `docs/SERVER.md`, which is the server's runbook.

`docker-compose.tls.yml` (nginx on `0.0.0.0:80/443` with its own certificate) exists for a server without a tunnel. It is not used here.

## 2. One-time server setup

Everything runs as the existing runner user `gh-runner` (already used by PCMS). From any checkout of this repository on the server, or after `curl`-ing the two scripts from `raw.githubusercontent.com/OSSC-DBIT/DBIT-PageCraft/master/deploy/`:

**a. The runner** (one per repository, like PCMS). In GitHub: the repository > Settings > Actions > Runners > New self-hosted runner > Linux, copy the value after `--token`, then:

```sh
sudo bash deploy/install-runner.sh <registration-token>
```

It installs the runner in `/srv/actions-runner-pagecraft` as `gh-runner` with the label `pagecraft`, registers it to `OSSC-DBIT/DBIT-PageCraft` and starts it as a systemd service. The Runners page should show `ossc-server-pagecraft` as Idle.

**b. The environments:**

```sh
sudo bash deploy/setup-environment.sh staging
sudo bash deploy/setup-environment.sh production
```

Each run creates, and never overwrites:

| Path | What | Owner, mode |
|---|---|---|
| `/srv/server-data/<env>/pagecraft/pagecraft.env` | all settings and secrets of that environment (database password, admin login, session secret, ports) | root:pagecraft 640 |
| `/etc/pagecraft/<env>.conf` | where things are: Compose project name, env file, health URL. No secrets | root 644 |
| `/var/lib/pagecraft-deploy/` | current and previous release, history, lock | gh-runner |
| `/usr/local/bin/pagecraft` | helper command, see below | root 755 |

The script prints the generated admin password once; store it. `gh-runner` is added to the `pagecraft` group so it can read the env file, and the runner service is restarted so the new group applies.

**c. Cloudflare.** Zero Trust > Networks > Tunnels > the server's existing tunnel > Public Hostname > Add:

| Subdomain | Domain | Type | URL |
|---|---|---|---|
| `dbitpagecraft-staging` | `webuildnow.in` | HTTP | `localhost:8091` |
| `dbitpagecraft` | `webuildnow.in` | HTTP | `localhost:8090` |

Plain HTTP on the loopback hop is fine: TLS ends at Cloudflare, and nginx restores the visitor's IP from `CF-Connecting-IP` and the `https` scheme from `X-Forwarded-Proto`, so rate limits and the Secure cookie flag behave as if the app were public. Recommended: SSL/TLS mode Full, Always Use HTTPS on, and optionally an Access policy in front of `/admin`.

**d. GitHub (optional).** Settings > Environments > `Production` > Required reviewers makes a push to `master` wait for approval before the runner starts. Protect `dev` and `master` (pull request + CI required, no force pushes): the repository is public and the runner has Docker access on the server, so only reviewed code may reach it. Keep "Require approval for all outside collaborators" on for workflow runs.

Then push to `dev`. Actions > Deploy shows CI, then the deploy log.

## 3. What a deploy does

`deploy/deploy.sh <staging|production> <sha>`, run by the runner from the checked-out commit:

1. Reads `/etc/pagecraft/<env>.conf`. Refuses a file not owned by root or writable by others.
2. Builds the app image as `pagecraft-app:<env>-<sha12>`, so staging and production never share an image.
3. Starts the database, then `docker compose up` for `db`, `app`, `nginx` with `APP_IMAGE` and `APP_VERSION` set to that tag. The app applies `server/schema.sql` on start-up (additive only).
4. Waits for the `app` and `nginx` health checks and requires `http://127.0.0.1:<HTTP_PORT>/api/health` to report `"version":"<env>-<sha12>"`.
5. Records the release in `/var/lib/pagecraft-deploy/<env>.current` and `.history`; keeps the five newest images of that environment.

One deploy per environment at a time (`flock` on the server, `concurrency` in the workflow). A failed deploy prints the container logs and stops.

## 4. Day-to-day

```sh
sudo pagecraft staging status            # release, containers, health, last deploys
sudo pagecraft production status
sudo pagecraft staging logs app -f       # or nginx, db
sudo pagecraft production admin          # admin login from the settings file
sudo pagecraft staging psql              # open the database
sudo pagecraft staging rollback          # previous release (or: rollback staging-<sha12>)
sudo pagecraft staging compose ps        # any docker compose command for that environment
```

Redeploy the same commit: GitHub > Actions > Deploy > Run workflow, pick the branch and environment. Production runs only from `master`.

Rotate the admin password or any secret: edit the env file, then `sudo pagecraft <env> compose up -d app` (or rerun the Deploy workflow).

## 5. Troubleshooting

- **Deploy job waits with "Waiting for a runner"**: the runner is offline. `systemctl status 'actions.runner.*'`, or `cd /srv/actions-runner-pagecraft && sudo ./svc.sh start`. Check the Runners page shows label `pagecraft`.
- **"env file ... is not readable"**: the runner is not in group `pagecraft` or was not restarted after being added. `sudo usermod -aG pagecraft gh-runner && sudo systemctl restart 'actions.runner.*'`.
- **"did not report version"**: the new app container never answered through nginx. `sudo pagecraft <env> logs app`; usually a wrong `POSTGRES_PASSWORD` after editing the env file (the volume keeps the old one) or a port taken by another stack.
- **Port already allocated**: another container owns `HTTP_PORT` or `APP_PORT`. `sudo ss -ltnp | grep <port>`, change the port in the env file and in `/etc/pagecraft/<env>.conf`, then redeploy and update the Cloudflare hostname.
- **Everyone hits 429**: nginx is not seeing real client IPs. Requests must come through `cloudflared` (which sets `CF-Connecting-IP`); the Docker bridge range is covered by `set_real_ip_from` in `nginx/nginx.conf`.
- **Admin login says insecure**: `COOKIE_SECURE=true` requires HTTPS at the edge; `TRUST_PROXY=1` must be set so the app believes `X-Forwarded-Proto`.
- **Database shell** without the helper: `docker compose -p pagecraft-prod --env-file /srv/server-data/production/pagecraft/pagecraft.env exec db psql -U pagecraft -d pagecraft` from the runner checkout.

## 6. Backups

PageCraft stores only the analytics table (`generations`). Dump it when needed:

```sh
sudo pagecraft production compose exec -T db pg_dump -U pagecraft -d pagecraft | gzip > /srv/server-data/production/pagecraft/pagecraft-$(date +%F).sql.gz
```

Restore with `gunzip -c file.sql.gz | sudo pagecraft production compose exec -T db psql -U pagecraft -d pagecraft`.
