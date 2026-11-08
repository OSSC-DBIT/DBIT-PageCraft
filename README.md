# DBIT PageCraft

<div align="center">

[![Live Demo](https://img.shields.io/badge/Live%20Demo-dbitpagecraft.mithungowda.in-4f46e5?style=for-the-badge&logo=googlechrome&logoColor=white)](https://dbitpagecraft.mithungowda.in)

[![CI](https://github.com/OSSC-DBIT/DBIT-PageCraft/actions/workflows/ci.yml/badge.svg)](https://github.com/OSSC-DBIT/DBIT-PageCraft/actions/workflows/ci.yml)
[![Deploy](https://github.com/OSSC-DBIT/DBIT-PageCraft/actions/workflows/deploy.yml/badge.svg)](https://github.com/OSSC-DBIT/DBIT-PageCraft/actions/workflows/deploy.yml)
[![Docker](https://img.shields.io/badge/Deploy-Docker%20Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](./docker-compose.yml)
[![nginx](https://img.shields.io/badge/Proxy-nginx-009639?style=flat-square&logo=nginx&logoColor=white)](./nginx)
[![Node.js](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-339933?style=flat-square&logo=nodedotjs&logoColor=white)](./server)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)](./server/schema.sql)
[![PWA](https://img.shields.io/badge/PWA-Enabled-5a0fc8?style=flat-square&logo=pwa&logoColor=white)](https://dbitpagecraft.mithungowda.in)
[![Vanilla JS](https://img.shields.io/badge/Frontend-Vanilla%20JS-f7df1e?style=flat-square&logo=javascript&logoColor=black)](./public/js)
[![License](https://img.shields.io/badge/License-Proprietary-red?style=flat-square)](./LICENSE)

**Maintained and managed by OSSC DBIT**

</div>

A responsive, self-hosted web app that generates pristine, academically formatted A4 documents for Don Bosco Institute of Technology (DBIT), Visvesvaraya Technological University (VTU): assignment front pages, major-project reports, and lab/project **Activity Book** covers, exportable as PDF, PNG, or **editable Word** files.

Document generation runs entirely in the browser. A small Node.js server hosts the app, records anonymous usage analytics in PostgreSQL, and protects the admin dashboard. The whole stack (nginx, app, database) ships as a single `docker compose up`. Installable as a **PWA** (works offline after first visit).

## Features

- **Three templates in one place**
  - **Assignment Front Page** - official DBIT/VTU layout with double border and Times New Roman typography
  - **Project Report** - Title Page, Certificate, Declaration and Acknowledgement for major projects (4 pages, selectable)
  - **Activity Book covers** - *Innovation and Design Thinking Lab (B25IDTL18)* and *Interdisciplinary Project Based Learning (B25PRJ28)*
- **Live exact preview** - see the page render in real time as you type, with zoom controls
- **Export options** - `.pdf`, high-resolution `.png`, and **editable `.doc` / `.docx`** (Microsoft Word)
- **PDF merge** - attach your assignment/report PDF and download one combined file
- **Auto-save** - your form data is remembered on the device (survives refresh / navigation)
- **Email capture** - first export asks for an email (then remembered), logged for analytics
- **Admin dashboard** - secured analytics with charts, a generation log, and a dedicated **Email List** with CSV export
- **Smart field pickers** - dropdowns for degree/branch/semester with a manual "Other" fallback
- **URL parameters API** - pre-fill fields and auto-download via query string
- **PWA** - installable, works offline, app icon on home screen
- **Self-hosted** - nginx + Node.js + PostgreSQL in Docker, no third-party services

## Tech Stack

**Frontend (public/)**
- **HTML5 and CSS3** - application UI and the exact A4 layout templates
- **Vanilla JavaScript** - real-time DOM data-binding, zero framework overhead
- **[html2canvas](https://html2canvas.hertzen.com/)** - high-fidelity HTML-to-canvas snapshot (PDF/PNG)
- **[jsPDF](https://github.com/parallax/jsPDF)** - assembles snapshots into A4 PDFs
- **[pdf-lib](https://pdf-lib.js.org/)** - client-side PDF merging
- **[html-docx-js](https://github.com/evidenceprime/html-docx-js)** + **[JSZip](https://stuk.github.io/jszip/)** - editable `.docx` generation (A4-patched)
- **[Chart.js](https://www.chartjs.org/)** - admin dashboard charts

**Backend (server/)**
- **[Node.js](https://nodejs.org/) + [Express](https://expressjs.com/)** - static hosting, JSON API, security headers (CSP, HSTS, etc.)
- **[PostgreSQL](https://www.postgresql.org/)** - analytics storage (`generations` table, schema applied automatically on startup)
- **[nginx](https://nginx.org/)** - reverse proxy, gzip, rate limiting, TLS termination
- **[Docker Compose](https://docs.docker.com/compose/)** - one-command deployment

## Project Structure

```
DBIT-PageCraft/
│
├── public/                        # Static PWA served by the Node app
│   ├── index.html                 # Assignment Front Page + Activity Book generator
│   ├── project-report.html        # 4-page Project Report generator (/project-report)
│   ├── admin.html                 # Secured analytics dashboard (/admin)
│   ├── 404.html                   # Custom 404 / offline fallback
│   ├── sw.js                      # Service Worker (PWA offline caching)
│   ├── manifest.json              # PWA Web App Manifest
│   ├── robots.txt, sitemap.xml, humans.txt, .well-known/security.txt
│   ├── css/
│   │   ├── styles.css             # Front-page UI + A4 layout styles
│   │   └── project-report-styles.css
│   ├── js/
│   │   ├── script.js              # Front-page logic (binding, capture, exports, templates)
│   │   ├── project-report-script.js
│   │   ├── admin.js               # Admin dashboard (login, charts, tables, CSV)
│   │   ├── analytics.js           # Posts generation records to /api/generations
│   │   ├── word-export.js         # Shared .doc/.docx builder (A4 OOXML / MHTML)
│   │   ├── form-cache.js          # localStorage auto-save helper
│   │   ├── email-gate.js          # Email prompt + cache + export gate
│   │   └── pwa.js                 # Service Worker registration and install prompt
│   └── assets/                    # Logos and PWA icons
│
├── server/                        # Node.js backend
│   ├── index.js                   # Express app: static files, API routes, security headers
│   ├── db.js                      # PostgreSQL pool + startup migration
│   ├── schema.sql                 # generations table, constraints, indexes
│   ├── auth.js                    # Admin login + signed httpOnly session cookie
│   ├── validate.js                # Whitelist/length validation for analytics records
│   └── rate-limit.js              # In-memory per-IP rate limiter
│
├── nginx/                         # Reverse proxy
│   ├── nginx.conf                 # gzip, logging, rate-limit zone, upstream
│   ├── conf.d/default.conf        # HTTP site (port 80, what cloudflared talks to)
│   ├── conf.d/tls.conf.example    # HTTPS site template for direct exposure without the tunnel
│   ├── conf.d/proxy.inc, proxy_headers.inc
│   └── certs/                     # Certificates for direct TLS only (git-ignored)
│
├── deploy/                        # Server scripts: install-runner, setup-environment, deploy, rollback
├── docs/DEPLOYMENT.md             # Staging + production on the OSSC server (runner, tunnel, ports)
├── Dockerfile                     # App image (node:22-alpine)
├── docker-compose.yml             # cloudflared (optional) + nginx + app + PostgreSQL
├── docker-compose.tls.yml         # Override: publish nginx on 0.0.0.0:80/443 (no tunnel)
├── .env.example                   # All configuration variables
├── package.json                   # express + pg, npm scripts
└── .github/workflows/
    ├── ci.yml                     # PRs and deploys: syntax, dashes, image build, nginx -t, compose, smoke test
    └── deploy.yml                 # dev -> staging, master -> production on the self-hosted runner
```

## Quick Start (Docker)

Requirements: Docker Engine 24+ with the Compose plugin.

```bash
git clone https://github.com/OSSC-DBIT/DBIT-PageCraft.git
cd DBIT-PageCraft

cp .env.example .env
# Edit .env: set POSTGRES_PASSWORD, ADMIN_EMAIL, ADMIN_PASSWORD, SESSION_SECRET
#   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"   # SESSION_SECRET

docker compose up -d --build
```

Then open:

| URL | What |
|-----|------|
| `http://localhost:8090/` | Assignment Front Page + Activity Book |
| `http://localhost:8090/project-report` | Project Report generator |
| `http://localhost:8090/admin` | Admin dashboard (sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`) |
| `http://localhost:8090/api/health` | Health check (used by Docker), reports `env` and deployed `version` |

nginx binds to `127.0.0.1:HTTP_PORT` (8090 in `.env.example`). Public traffic is meant to arrive through Cloudflare Tunnel, so no port has to be opened on the server.

Useful commands:

```bash
docker compose logs -f app        # application logs
docker compose ps                 # container status + health
docker compose down               # stop (data persists in the pgdata volume)
docker compose down -v            # stop AND delete the database volume
docker compose exec db psql -U pagecraft -d pagecraft   # open a SQL shell
```

## Staging and Production (OSSC server, Cloudflare Tunnel, GitHub Actions)

The full guide is in [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md). In short, it works like PCMS on the same server:

- Pushing to `dev` runs CI and then deploys **staging** (`dbitpagecraft-staging.webuildnow.in`); pushing to `master` deploys **production** (`dbitpagecraft.webuildnow.in`). The deploy runs on a self-hosted GitHub Actions runner on the server, so no SSH key or server secret is stored in GitHub.
- Ports per environment: staging nginx `127.0.0.1:8091` and app `3091`, production nginx `127.0.0.1:8090` and app `3090`. PostgreSQL is never published. The server's existing `cloudflared` publishes those loopback ports as the hostnames above.
- Settings live in `/srv/server-data/<env>/pagecraft/pagecraft.env` (root:pagecraft 640), created by `deploy/setup-environment.sh`. The runner is installed by `deploy/install-runner.sh`.
- `deploy/deploy.sh` builds `pagecraft-app:<env>-<sha>`, starts the stack, waits for health and checks that `/api/health` reports that version. `deploy/rollback.sh` returns to the previous image. `sudo pagecraft <env> status|logs|psql|rollback` is the day-to-day helper on the server.

### Direct HTTPS without the tunnel

1. Obtain a certificate (for example `certbot certonly --standalone -d your.domain`) and copy `fullchain.pem` and `privkey.pem` into `nginx/certs/`.
2. `cp nginx/conf.d/tls.conf.example nginx/conf.d/tls.conf`, replace `your.domain`, and remove `nginx/conf.d/default.conf`.
3. Start with the TLS override: `docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d`.

Either way the app reads `X-Forwarded-Proto` from nginx and marks the admin session cookie `Secure` on HTTPS. Set `COOKIE_SECURE=true` in production to enforce it.

## Local Development (without Docker)

```bash
npm install
cp .env.example .env
# set DATABASE_URL to a reachable PostgreSQL, e.g. the compose db with its ports entry uncommented
npm run dev        # node --env-file=.env --watch server/index.js  ->  http://localhost:3000
```

The server applies `server/schema.sql` on every start, so there is no separate migration step.

## Configuration

All variables are documented in [`.env.example`](./.env.example).

| Variable | Purpose |
|----------|---------|
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Database credentials (compose builds `DATABASE_URL` from them) |
| `DATABASE_URL` | Connection string when running outside Docker |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | The single admin account for `/admin` |
| `SESSION_SECRET` | Signs the admin session cookie (32+ random characters) |
| `SESSION_HOURS` | Admin session lifetime (default 8) |
| `COMPOSE_PROJECT_NAME`, `APP_ENV` | Environment identity; non-production sends `X-Robots-Tag: noindex` |
| `COMPOSE_PROFILES`, `CF_TUNNEL_TOKEN` | `tunnel` + connector token enables the Cloudflare Tunnel container |
| `HTTP_BIND`, `HTTP_PORT` | Where nginx is bound on the host (`127.0.0.1:8090` in `.env.example`) |
| `HTTPS_PORT` | Only with `docker-compose.tls.yml` (direct exposure) |
| `APP_PORT` | Host port for direct access to the Node app, bound to 127.0.0.1 (3090 in `.env.example`) |
| `TRUST_PROXY` | Number of trusted proxy hops (1 for the bundled nginx) |
| `COOKIE_SECURE` | Force the cookie Secure flag on/off; blank = auto from HTTPS |

## API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/generations` | none | Record an export. JSON body: `page`, `type`, `student_name`, `usn`, `subject`, `subject_code`, `topic`, `semester`, `section`, `branch`, `email`. Values are whitelisted/length-limited; 60 requests per 10 minutes per IP. |
| `POST` | `/api/admin/login` | none | `{ email, password }`; sets an httpOnly session cookie. 10 attempts per 15 minutes per IP. |
| `POST` | `/api/admin/logout` | cookie | Clears the session cookie. |
| `GET` | `/api/admin/me` | cookie | Current admin session. |
| `GET` | `/api/admin/generations?limit=N` | cookie | Most recent rows (max 5000). |
| `GET` | `/api/health` | none | `{ status, db }`; 503 if the database is unreachable. |

Security headers set on every response: `Content-Security-Policy` (scripts only from self and the pinned CDNs), `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and `Strict-Transport-Security` over HTTPS.

## Templates and Export Formats

### Templates
Switch templates from the **Template** dropdown at the top of the front-page sidebar:

| Template | Fields |
|----------|--------|
| Assignment Front Page | topic, subject, code, degree, branch, student, USN, semester, section, guide |
| Activity Book - IDTL | student, USN, branch, section, semester, academic year, team name/strength, mentor |
| Activity Book - Project | same as IDTL, with *Name of the Guide* instead of *Mentor* |

The Project Report (separate page) lets you choose which of the 4 pages to export via checkboxes. The selection applies to PDF, Word and merged exports alike.

### Export formats
- **PDF / PNG** - rasterized snapshot of the live page (pixel-perfect to the preview).
- **Word (`.docx`)** - real OOXML produced by html-docx-js and **re-packaged to A4**; fully **editable** in Microsoft Word. Logos are embedded.
- **Word (`.doc`)** - packaged as MHTML so logos render and text stays **editable** in Word.

> Note: the Word files are genuinely editable (not an image). Decorative borders are simplified versions of the on-screen design, since Word can't reproduce rounded/corner-square borders. `.docx` is built for Microsoft Word; very old LibreOffice/Google Docs versions may render the embedded content imperfectly.

Exported files are named after the subject and student, for example `Engineering_Chemistry_Front_Page_Jane_Doe.pdf`.

## Saved Data and Privacy

The app stores small amounts of data in your browser's **localStorage** (per device/browser):

| Key | Contents |
|-----|----------|
| `dbit_pagecraft_frontpage` | Front-page / activity-book form fields + selected template |
| `dbit_pagecraft_report` | Project-report fields, student list, page selection |
| `dbit_pagecraft_email` | The email entered at first export |

On any export, if no email is cached the app asks for one (and remembers it). The email is sent with the analytics record to **your own server** (nothing leaves your infrastructure).

### Clearing saved data
- **Console (this site only):**
  ```js
  localStorage.removeItem('dbit_pagecraft_frontpage');
  localStorage.removeItem('dbit_pagecraft_report');
  localStorage.removeItem('dbit_pagecraft_email');
  location.reload();
  ```
  or with the built-in helpers: `FormCache.clear('dbit_pagecraft_frontpage')`, `EmailGate.clear()`.
- **Everything for the site:** `localStorage.clear()` in the console.
- **DevTools:** Application > Storage > Local Storage > delete the keys.

## URL Parameters API

Pre-fill and optionally auto-download via the query string.

**Front page** (`/`):
```
/?topic=...&subject=...&code=...&degree=...&branch=...&name=...&usn=...&semester=...&section=...&guide=...&guideTitle=...&guideDept=...&download=pdf|png|doc|docx
```

**Project report** (`/project-report`):
```
/project-report?title=...&phase=...&degree=...&branch=...&semester=...&year=...&dept=...&deptFull=...&guide=...&guideTitle=...&hod=...&hodQual=...&hodTitle=...&principal=...&principalQual=...&coordinator=...&coordinatorTitle=...&students=Name1:USN1,Name2:USN2&pages=0,1,2,3&download=true|doc|docx
```

## PWA (Progressive Web App)

DBIT PageCraft is fully installable:

- **Android/Chrome** - tap the install banner or the install icon in the address bar
- **iOS/Safari** - Share > Add to Home Screen
- **Desktop Chrome/Edge** - install icon in the address bar

After installation all static assets (HTML, CSS, JS, logos, CDN libraries) are cached by the Service Worker. The app functions fully offline: you can generate and export documents without an internet connection. Analytics logging silently skips when offline and `/api/*` requests are never cached.

### Updating the Service Worker cache

When you change a file in `public/`:
1. Bump its `?v=` query string in the HTML that loads it.
2. Mirror the same `?v=` in the `PRECACHE_URLS` list in `public/sw.js`.
3. Bump `CACHE_NAME` in `public/sw.js` (e.g. `dbit-pagecraft-v4` to `dbit-pagecraft-v5`).

The next visit clears the old cache and users see a "new version ready" toast.

## Admin Dashboard

At `/admin` (sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`):
- **Stats** - totals by type (PDF, PNG, Report, Merge, Word docs), unique students, unique emails
- **Charts** - daily usage (last 14 days, in your local time zone) and breakdown by type
- **Generation Log** - searchable, most-recent-first
- **Email List** - deduplicated emails with name, export count, and last activity, plus **Export CSV** and **Copy emails**

Sessions are signed httpOnly cookies that expire after `SESSION_HOURS`. All values in the dashboard are HTML-escaped before rendering.

## Backups

The database lives in the `pgdata` Docker volume.

```bash
# dump
docker compose exec -T db pg_dump -U pagecraft pagecraft > backup_$(date +%F).sql
# restore
cat backup_2026-11-08.sql | docker compose exec -T db psql -U pagecraft -d pagecraft
```

## Team

- **[Mithun Gowda B](https://www.linkedin.com/in/mithungowdab/)** - Creator and Developer - [mithungowda.b7411@gmail.com](mailto:mithungowda.b7411@gmail.com)
- **[Naren V](https://www.linkedin.com/in/naren-v-29b39939a/)**
- **[Harsha N](https://www.linkedin.com/in/harsha1218/)**
- **[Nevil Anson DSouza](https://www.linkedin.com/in/nevil-anson-dsouza/)**
- **[Manas Kiran Habbu](https://www.linkedin.com/in/manas-kiran-habbu-058487306/)** - Marketing
- **[Lekhan H R](https://www.linkedin.com/in/lekhan-hr-507b89371/)**

*Don Bosco Institute of Technology, Bengaluru*

**Maintained and managed by OSSC DBIT.**

## Acknowledgement

Credits: **[Mahesh Kumar G](https://www.linkedin.com/in/maheshkgdev/)**

## License

This project is proprietary software. All rights reserved.
See [LICENSE](./LICENSE) for full terms.
Unauthorized copying, distribution, or commercial use is strictly prohibited.
