# docuchat-saas
SaaS for creating RAG chatbots from uploaded documents.

## Prerequisites
- Node.js 20+
- npm 10+
- Docker (for local Postgres/Redis/MinIO)

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start local infrastructure services:
   ```bash
   docker compose up -d
   ```
3. Configure environment variables (see below). The config package loads `.env` automatically.

## Environment variables
Create a `.env` file at the repo root to override defaults. `.env.local` (if present) overrides `.env`.

```dotenv
NODE_ENV=development
PORT=3000
API_LOG_LEVEL=info
WORKER_LOG_LEVEL=info
DATABASE_URL=postgres://docuchat:docuchat@localhost:5432/docuchat
REDIS_URL=redis://localhost:6379
QUEUE_NAME=docuchat-jobs
WORKER_HEARTBEAT_MS=10000
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_BUCKET=docuchat
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin

# Auth
AUTH_ACCESS_TOKEN_SECRET=change-me-access
AUTH_REFRESH_TOKEN_SECRET=change-me-refresh
AUTH_ACCESS_TOKEN_TTL_SECONDS=900
AUTH_REFRESH_TOKEN_TTL_SECONDS=2592000
AUTH_JWT_ISSUER=docuchat
AUTH_JWT_AUDIENCE=docuchat-api
AUTH_ACCESS_COOKIE_NAME=docuchat_access
AUTH_REFRESH_COOKIE_NAME=docuchat_refresh
AUTH_CSRF_COOKIE_NAME=docuchat_csrf
AUTH_COOKIE_DOMAIN=
AUTH_SECURE_COOKIES=true
AUTH_PASSWORD_MIN_LENGTH=12
APP_BASE_URL=http://localhost:3000
```

### Dotenv loading strategy
- `@docuchat/config` loads environment files once per process.
- Resolution order: `.env` then `.env.local` from the first directory found when walking up from `process.cwd()`.
- Set `DOCUCHAT_ENV_FILE=/absolute/or/relative/path` to load a specific file (useful for CI/tests).

## Development
Run all apps in dev mode (Turbo):
```bash
npm run dev
```

Need more detail? See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Common scripts
- `npm run build` — build all apps/packages
- `npm run lint` — lint all apps/packages
- `npm run format` — format supported files
- `npm run test` — run workspace tests
- `npm run smoke:boot` — smoke test API + worker boot (requires local services)
- `npm run db:migrate` — run migrations
- `npm run db:status` — migration status
- `npm run db:rollback` — dev-only down migration
- `npm run db:seed:admin` — seed an owner account

## Services
- API: `apps/api`
- Worker: `apps/worker`
- Shared config: `packages/config`

## Local infrastructure
The included `docker-compose.yml` starts:
- Postgres (pgvector)
- Redis
- MinIO

To stop services:
```bash
docker compose down
```
