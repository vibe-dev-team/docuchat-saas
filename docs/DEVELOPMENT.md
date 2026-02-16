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

## RAG / OpenAI config
The Q&A endpoint uses OpenAI for embeddings + chat completions. Ensure these are set in your `.env` or `.env.local` before calling `/conversations/:id/messages`:
- `OPENAI_API_KEY`
- `OPENAI_CHAT_MODEL` (default: `gpt-4o-mini`)
- `OPENAI_CHAT_TEMPERATURE` (default: `0.2`)
- `OPENAI_CHAT_MAX_TOKENS` (default: `512`)
- `RAG_TOP_K` (default: `5`)
- `RAG_MAX_HISTORY_MESSAGES` (default: `10`)
- `RAG_MAX_CONTEXT_CHARS` (default: `6000`)

## Common scripts
- `npm run build` — build all apps/packages
- `npm run lint` — lint all apps/packages
- `npm run test` — run workspace tests
- `npm run format` — format supported files
- `npm run smoke:boot` — start API + worker and verify /health (requires local Postgres + Redis)
- `npm run smoke:chatbots` — exercise chatbot CRUD + Q&A flow (requires seeded user + ready document, API already running)
- `npm run smoke:chatbots:run` — start API + worker, then run chatbot smoke
- `npm run db:migrate` — run dbmate migrations
- `npm run db:status` — show migration status
- `npm run db:rollback` — **dev-only** down migration (blocked in prod)
- `npm run db:seed:admin` — seed an owner account
- `npm run db:seed:smoke` — seed/update a smoke test user + tenant

## Smoke test setup (env)
Smoke scripts load env from `DOCUCHAT_ENV_FILE` if set, otherwise `.env`/`.env.local` (with `.env.local` overriding). Put `SMOKE_*` values in `.env.local` to avoid exporting them each run.

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

## Smoke test (ingestion)
Prereqs:
- Seed an admin user (or smoke user):
  - Admin: `ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=StrongPass123 npm run db:seed:admin`
  - Smoke user: `SMOKE_EMAIL=you@example.com SMOKE_PASSWORD=StrongPass123 npm run db:seed:smoke`
- Ensure the MinIO bucket exists (see "Create the MinIO bucket" below).
- Set `OPENAI_API_KEY` for embeddings (required for ingestion).

```bash
npm run build
SMOKE_EMAIL=you@example.com \
SMOKE_PASSWORD=StrongPass123 \
OPENAI_API_KEY=sk-... \
npm run smoke:ingest
```

If you stored `SMOKE_*` in `.env.local`, you can omit them from the command line.

Optional env:
- `SMOKE_API_BASE_URL` (default `http://localhost:4010`)
- `SMOKE_PDF_PATH` to override the bundled sample PDF
- `AUTH_ACCESS_COOKIE_NAME`, `AUTH_CSRF_COOKIE_NAME` if you override cookie names

## Smoke test (chatbot CRUD + Q&A flow)
Prereqs:
- Seed an admin user (or smoke user):
  - Admin: `ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=StrongPass123 npm run db:seed:admin`
  - Smoke user: `SMOKE_EMAIL=you@example.com SMOKE_PASSWORD=StrongPass123 npm run db:seed:smoke`
- Ingest a PDF so it reaches `ready` status (see `docs/M2_INGESTION.md`).
- Export `SMOKE_DOCUMENT_ID` for a ready document.
- Ensure `OPENAI_API_KEY` is set for embeddings + chat completions (or set `SMOKE_SKIP_QA=true` to skip Q&A).

```bash
npm run build
SMOKE_EMAIL=you@example.com \
SMOKE_PASSWORD=StrongPass123 \
SMOKE_DOCUMENT_ID=<ready-document-id> \
OPENAI_API_KEY=sk-... \
npm run smoke:chatbots:run
```

If the API + worker are already running, you can use `npm run smoke:chatbots` instead of `smoke:chatbots:run`.
If you stored `SMOKE_*` in `.env.local`, you can omit them from the command line.

Optional env:
- `SMOKE_API_BASE_URL` (default `http://localhost:4010`)
- `SMOKE_SKIP_QA=true` to only validate CRUD + conversation creation
- `AUTH_ACCESS_COOKIE_NAME`, `AUTH_CSRF_COOKIE_NAME` if you override cookie names

## Local service ports
- Redis: `localhost:6379` (override with `REDIS_PORT=6380` before `docker compose up`)
- MinIO S3 API: `http://localhost:9002` (set `S3_ENDPOINT` to match)
- MinIO console UI: `http://localhost:9003`
- `APP_BASE_URL` controls the base URL used in mailer links (magic links, password reset)

## Create the MinIO bucket (one-time)
Ingestion expects the bucket in `S3_BUCKET` to exist. After `docker compose up -d`, run:
```bash
docker run --rm --network host minio/mc sh -c \
  "mc alias set local http://localhost:9002 minioadmin minioadmin && mc mb -p local/docuchat"
```
If you changed `S3_BUCKET`, replace `docuchat` with your bucket name.

## Troubleshooting
- **Missing env errors**: ensure `.env` exists or set `DOCUCHAT_ENV_FILE`.
- **Missing SMOKE_EMAIL/SMOKE_PASSWORD**: seed a user (`ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=StrongPass123 npm run db:seed:admin`) and export `SMOKE_EMAIL`/`SMOKE_PASSWORD` (or add them to `.env`).
- **Services not reachable**: verify `docker compose ps` and check ports 5432 (Postgres), 6379 (Redis), 9002 (MinIO S3), 9003 (MinIO console).
- **Redis port conflicts**: set `REDIS_PORT=6380` (or another free port) in your shell or `.env` before `docker compose up`.

## API endpoints (selected)
- `GET /tenants/:tenantId/members` → `{ members: [{ id, email, role, createdAt }] }`
- `GET /chatbots` and `GET /chatbots/:id` include `documentIds: string[]` for linked documents.
