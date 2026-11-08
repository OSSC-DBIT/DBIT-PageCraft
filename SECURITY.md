# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

- Email: [mithungowda.b7411@gmail.com](mailto:mithungowda.b7411@gmail.com)
- Do NOT open a public issue for security vulnerabilities

We will acknowledge your report within 48 hours and provide a fix as soon as possible.

## Bug Bounty

This project does **not** have a bug bounty program. We appreciate responsible disclosure but cannot offer monetary rewards.

## Scope

- Authentication or session bypass on the admin API (`/api/admin/*`)
- Bypassing validation or rate limiting on the public analytics endpoint (`/api/generations`)
- XSS or injection in the generators or the admin dashboard
- Exposed credentials or secrets in the repository or Docker images
- Weaknesses in the shipped nginx or Docker configuration

## Out of Scope

- The public analytics endpoint is intentionally unauthenticated (it only inserts validated rows)
- Client-side code is fully visible by design (static site)
- Issues that require physical access to the user's device
- Misconfigured deployments that ignore the documented setup (for example, running without HTTPS)

## Hardening Notes for Operators

- Keep `.env` out of version control and use long random values for `POSTGRES_PASSWORD`, `ADMIN_PASSWORD` and `SESSION_SECRET`.
- Terminate TLS at nginx (see `nginx/conf.d/tls.conf.example`) so the admin session cookie is only sent over HTTPS.
- Do not publish the database port to the public internet.
