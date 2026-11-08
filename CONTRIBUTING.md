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
4. Open `http://localhost` in your browser (admin at `/admin`)

Working on the frontend only? `npm install` and `npm run dev` runs the Node server with file watching; it still needs a PostgreSQL `DATABASE_URL` in `.env` (you can keep using the `db` container by uncommenting its `ports` entry in `docker-compose.yml`).

## Project Structure

```
DBIT-PageCraft/
├── public/                 # Static PWA (HTML, CSS, JS, assets, service worker)
├── server/                 # Node.js API + static file server
├── nginx/                  # Reverse proxy configuration (HTTP + optional TLS)
├── Dockerfile              # App image
└── docker-compose.yml      # nginx + app + PostgreSQL
```

## How to Contribute

### Reporting Bugs

- Open an issue with a clear title and description
- Include steps to reproduce the bug
- Add screenshots if applicable

### Suggesting Features

- Open an issue with the `enhancement` label
- Describe the feature and why it would be useful

### Submitting Changes

1. Create a new branch: `git checkout -b feature/your-feature`
2. Make your changes
3. Test locally to ensure nothing breaks (`docker compose up --build`)
4. Commit with a clear message: `git commit -m "feat: add your feature"`
5. Push and open a Pull Request

## Guidelines

- Frontend stays vanilla JS with CDN libraries, no bundler or framework
- Server code lives in `server/` and should keep its dependency footprint small (currently `express` and `pg`)
- Never render untrusted values with `innerHTML` without escaping; prefer `textContent` or DOM APIs
- When you change a precached file in `public/`, bump its `?v=` in the HTML, mirror it in `public/sw.js`, and bump `CACHE_NAME`
- Test on both desktop and mobile
- Ensure PDF output quality is not affected by UI changes
- Do not use em dashes or en dashes in code, comments or docs; use a plain hyphen

## Questions?

Reach out at [mithungowda.b7411@gmail.com](mailto:mithungowda.b7411@gmail.com)
