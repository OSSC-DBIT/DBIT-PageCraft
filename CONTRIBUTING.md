# Contributing to DBIT PageCraft

Thanks for your interest in contributing! DBIT PageCraft is maintained and managed by OSSC DBIT. Here's how you can help.

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR-USERNAME/DBIT-PageCraft.git
   cd DBIT-PageCraft
   ```
3. Create your environment file and start the stack:
   ```bash
   cp .env.example .env      # fill in passwords + admin login
   docker compose up -d --build
   ```
4. Open `http://localhost:8090` in your browser (admin at `/admin`, health at `/api/health`)

Working on the frontend only? `npm install` and `npm run dev` runs the Node server with file watching; it still needs a PostgreSQL `DATABASE_URL` in `.env` (you can keep using the `db` container by uncommenting its `ports` entry in `docker-compose.yml`).

## Project Structure

```
DBIT-PageCraft/
├── public/                 # Static PWA (HTML, CSS, JS, assets, service worker)
├── server/                 # Node.js API + static file server
├── nginx/                  # Reverse proxy configuration (HTTP + optional TLS)
├── deploy/                 # Server scripts: runner install, environment setup, deploy, rollback
├── docs/DEPLOYMENT.md      # How staging and production are hosted and deployed
├── Dockerfile              # App image
└── docker-compose.yml      # nginx + app + PostgreSQL
```

## Branches and Deployment

| Branch | What it is | Where it goes |
|---|---|---|
| `feature/*`, `fix/*` | your work | nowhere; CI runs on the pull request |
| `dev` | integration branch | **staging** at `dbitpagecraft-staging.webuildnow.in`, deployed automatically |
| `master` | released code | **production** at `dbitpagecraft.webuildnow.in`, deployed automatically |

Both `dev` and `master` are protected: changes arrive through a pull request, the CI check must pass and the branch must be up to date, force pushes and deletions are blocked. The flow is feature branch -> pull request into `dev` -> check it on staging -> pull request from `dev` into `master`.

Every push to `dev` or `master` runs the full CI first and then `deploy/deploy.sh` on the OSSC server through a self-hosted runner. Never deploy by hand; if a release is bad, use `sudo pagecraft <env> rollback` on the server or merge a fix. Details in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

Because the runner has Docker access on the server, nothing under `.github/` or `deploy/` from an outside contributor is merged without a maintainer reading it line by line.

## How to Contribute

### Reporting Bugs

- Open an issue with a clear title and description
- Include steps to reproduce the bug
- Add screenshots if applicable

### Suggesting Features

- Open an issue with the `enhancement` label
- Describe the feature and why it would be useful

### Submitting Changes

1. Branch from `dev`: `git checkout dev && git pull && git checkout -b feature/your-feature`
2. Make your changes
3. Test locally to ensure nothing breaks (`docker compose up -d --build`, then try an export and the admin page)
4. Add a line under **Unreleased** in `CHANGELOG.md`
5. Commit with a clear message: `git commit -m "feat: add your feature"`
6. Push and open a pull request against `dev`. CI must be green before it can be merged.

What CI checks on every pull request: syntax of all server, browser and deploy scripts, no em or en dashes, the Docker image builds, `nginx -t` passes, both compose files validate, and the built image answers on `/api/health`, `/` and `/project-report`.

## Guidelines

- Frontend stays vanilla JS with CDN libraries, no bundler or framework
- Server code lives in `server/` and should keep its dependency footprint small (currently `express` and `pg`)
- Never render untrusted values with `innerHTML` without escaping; prefer `textContent` or DOM APIs
- When you change a precached file in `public/`, bump its `?v=` in the HTML, mirror it in `public/sw.js`, and bump `CACHE_NAME`
- Schema changes go in `server/schema.sql` and must be additive (new tables, new nullable columns), because the app applies it on start-up and a rollback runs the previous release against the same database
- New configuration goes in `.env.example` with a comment, in `docker-compose.yml`, and in `deploy/setup-environment.sh` if the server needs a value for it
- Shell scripts keep LF line endings (enforced by `.gitattributes`) and must pass `bash -n`
- Test on both desktop and mobile
- Ensure PDF output quality is not affected by UI changes
- Do not use em dashes or en dashes in code, comments or docs; use a plain hyphen

## Questions?

Reach out at [mithungowda.b7411@gmail.com](mailto:mithungowda.b7411@gmail.com)
