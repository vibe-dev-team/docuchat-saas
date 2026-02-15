# Development Guide

## Prerequisites
- Node.js 20+
- npm 10+
- Docker (for Postgres/Redis/MinIO)

## Quick start
```bash
npm install
docker compose up -d
npm run dev
```

## Running apps
- API: `npm run dev -- --filter @docuchat/api`
- Worker: `npm run dev -- --filter @docuchat/worker`

## Environment management
`@docuchat/config` loads environment files automatically:
- Searches upward from `process.cwd()` for `.env` and `.env.local`.
- Loads `.env` first, then `.env.local` (local overrides).
- Override with `DOCUCHAT_ENV_FILE=/path/to/file` for CI/tests.

Recommended setup:
- `.env` → shared defaults for local dev
- `.env.local` → personal overrides (not committed)

## Common scripts
- `npm run build` — build all apps/packages
- `npm run lint` — lint all apps/packages
- `npm run test` — run workspace tests
- `npm run format` — format supported files
- `npm run smoke:boot` — start API + worker and verify /health (requires local Postgres + Redis)
- `npm run db:migrate` — run dbmate migrations
- `npm run db:status` — show migration status
- `npm run db:rollback` — **dev-only** down migration (blocked in prod)
- `npm run db:seed:admin` — seed an owner account

## Database migrations (dbmate)
Migrations live in `db/migrations` and are SQL-first.

For local Postgres (docker compose), set `DATABASE_URL` with `?sslmode=disable` so dbmate connects without SSL.

```bash
npm run db:migrate
npm run db:status
```

Down migrations are **blocked in production** by `scripts/dbmate-guard.cjs`. Use `npm run db:rollback` only in dev.

## Smoke test (API + worker boot)
Run this after `npm run build` with local services running:
```bash
docker compose up -d
npm run build
npm run smoke:boot
```
The smoke test waits for Postgres/Redis, starts the worker and API on port 4010, then checks `/health`.

## Troubleshooting
- **Missing env errors**: ensure `.env` exists or set `DOCUCHAT_ENV_FILE`.
- **Services not reachable**: verify `docker compose ps` and check ports 5432 (Postgres), 6379 (Redis), 9000 (MinIO).
- **Redis port conflicts**: set `REDIS_PORT=6380` (or another free port) in your shell or `.env` before `docker compose up`.
