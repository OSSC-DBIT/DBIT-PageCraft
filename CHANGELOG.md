# Changelog

All notable changes to DBIT PageCraft are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Dates are in ISO format. Entries that change the database schema or the server configuration are marked so operators know what a deploy will touch.

## Unreleased

- Contact address is now osscdbit@gmail.com and the OSSC DBIT attribution links to https://www.linkedin.com/company/ossc-dbit (pages, README, CONTRIBUTING, SECURITY, LICENSE, humans.txt, security.txt). Old Vercel hostname in sitemap, robots.txt, security.txt and README badges replaced with dbit-pagecraft.webuildnow.in. Service worker cache bumped to v5.

## 2026-11-08 Self-hosting and continuous deployment

Moved off Vercel and Supabase onto the OSSC server. Deploys run through GitHub Actions and a self-hosted runner, the same way as PCMS.

### Added
- Node.js/Express server (`server/`) that serves the static PWA with clean URLs, a JSON API and security headers (CSP, HSTS, X-Robots-Tag on non-production).
- PostgreSQL storage for export analytics (`generations` table, `server/schema.sql`, applied on start-up). **Schema: new.**
- Admin dashboard sign-in with a single env-configured account, HMAC-signed httpOnly cookie, constant-time comparison, login rate limit.
- Input validation and rate limiting on the public analytics endpoint; CSV export in the dashboard escapes formula-injection characters.
- Docker image (`Dockerfile`), `docker-compose.yml` (nginx, app, PostgreSQL, optional cloudflared), `docker-compose.tls.yml` for direct HTTPS exposure.
- nginx reverse proxy with gzip, request rate limiting, real visitor IP from `CF-Connecting-IP` and forwarded scheme from Cloudflare.
- GitHub Actions: `ci.yml` (syntax, dash check, image build, `nginx -t`, compose validation, smoke test of the built image) and `deploy.yml` (CI, then deploy on the self-hosted runner; `dev` to staging, `master` to production).
- Server scripts in `deploy/`: `install-runner.sh`, `setup-environment.sh`, `deploy.sh`, `rollback.sh`, and the `pagecraft` helper command installed on the server.
- `docs/DEPLOYMENT.md` with ports, folder layout, Cloudflare hostnames, day-to-day commands and troubleshooting.
- "Maintained and managed by OSSC DBIT" attribution on every page, in the README, humans.txt and docs.
- `.gitattributes` keeping shell scripts LF.

### Changed
- Frontend moved to `public/`; analytics calls go to `/api/generations` through `public/js/analytics.js` instead of Supabase.
- Admin dashboard rewritten: cookie-based API helper, HTML escaping of every stored value, local-time day grouping.
- Project report generator: DOM-based student entry builder, required-field validation before export, merge iterates the selected pages.
- Export filenames derive from the subject name.
- Inline `onerror` handlers replaced with `setupLogoFallbacks()` so the CSP needs no `unsafe-inline` for scripts.
- Service worker cache name bumped to `dbit-pagecraft-v4` with updated precache versions.
- All em and en dashes replaced with hyphens across the repository; CI rejects new ones.
- Repository links point to `github.com/OSSC-DBIT/DBIT-PageCraft`.

### Removed
- Vercel configuration, Supabase client and keep-alive workflow, `config.js` files with API keys.

### Operations
- Ports on the OSSC server: staging nginx `127.0.0.1:8091` and app `3091`; production nginx `127.0.0.1:8090` and app `3090`.
- Settings live in `/srv/server-data/<env>/pagecraft/pagecraft.env` (root:pagecraft 640); `/etc/pagecraft/<env>.conf` says where things are.
- Public hostnames `dbit-pagecraft-staging.webuildnow.in` and `dbit-pagecraft.webuildnow.in` through the server's existing Cloudflare Tunnel.
- `master` and `dev` are protected: pull request plus passing CI required, no force pushes.

## 2026-08-27

### Added
- PWA support (manifest, service worker, install prompt), `.env` build pipeline for Vercel, Supabase keep-alive workflow.

### Fixed
- Vercel clean URL 404s for `/admin` and `/project-report`.

## 2026-06-19

### Added
- Template chooser for the assignment front page.

### Fixed
- Activity book analytics logging.

## 2026-06-11

### Added
- Bold toggle for the Submitted By and Guided By blocks.

## 2026-06-05 to 2026-06-06

### Added
- Word (`.docx`) export, activity book templates, form caching, email gate, custom 404 page, CODE_OF_CONDUCT, CONTRIBUTING, SECURITY, sitemap, GitHub issue templates.

### Fixed
- Correct student data logged for activity book templates; guide name on its own line after the label.

## 2026-06-04

### Added
- Rebrand to DBIT PageCraft, Major Project Report generator (title, certificate, declaration, acknowledgement pages), URL parameter API for pre-filling and auto-download, navigation between generators, Supabase analytics.

## 2026-05-29

### Added
- First release: assignment front page generator with PDF export, client-side PDF merge, select pickers for degree, branch and semester with an "Other" option, 26-character word-boundary wrapping, proprietary license.
