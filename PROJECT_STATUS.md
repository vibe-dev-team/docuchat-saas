# Project Status: Project DocuChat

**Current State:** M1_FIX_BLOCKERS_COMPLETE

**Stack Choices (Confirmed):**
- API: Fastify + TypeScript
- Queue: BullMQ + Redis
- Vector DB: Postgres + pgvector
- Object Storage: S3-compatible (MinIO)

**Progress Notes:**
- Created apps/api and apps/worker scaffolds.
- 2026-02-15: Spawned agent to run migrations, seed admin, and smoke-check auth flows (in progress).
- 2026-02-15: Migrations + seed OK with `sslmode=disable`. Blockers found: Fastify cookie plugin version mismatch (API won't start), TS build errors for `rowCount` possibly null, Redis port conflicts in docker-compose; auth smoke checks could not run.
- 2026-02-15: Updated @fastify/cookie to v10, fixed `rowCount` null checks, documented `sslmode=disable` for local dbmate, made Redis port configurable in docker-compose. `npm run build` now passes; auth smoke still pending.
- Added shared packages: config, logger, db, queue.
- Added root tsconfig, ESLint/Prettier config, workspace setup.
- Added .env.example and docker-compose for Postgres+pgvector, Redis, MinIO.
- Wired API/worker to shared config/logger/db/queue with env validation + queue helpers.
- Updated API/worker package deps; added worker heartbeat settings.
- Fixed Turbo v2 config (pipeline→tasks), added Node typings and flat ESLint config; resolved queue typing.
- Build and lint now pass (`npx turbo run build --force`, `npm run lint`).
- Expanded README and added docs/DEVELOPMENT.md with env strategy and dev tips.
- Implemented dotenv loading strategy in @docuchat/config (search .env/.env.local or DOCUCHAT_ENV_FILE override).
- Verified build (`npm run build`).
- NPM audit clean; Fastify already at latest 5.7.4.
- Added CI concurrency + permissions and a smoke test step that boots services and runs `npm run smoke:boot`.
- Added smoke test script (`scripts/smoke/boot.cjs`) plus documentation updates.
- Drafted M1 plan in `docs/M1_PLAN.md`.
- Added dbmate config + baseline SQL migrations for tenants/users/memberships/tokens/invites.
- Added auth env configuration + updated .env.example defaults.
- Implemented auth API (register, verify email, login, refresh rotation, logout, forgot/reset password, invites).
- Added CSRF double-submit cookie checks and password policy enforcement.
- Added seed admin script (`npm run db:seed:admin`).
- Added auth docs + expanded README/DEVELOPMENT and CI test step.

**Next Step:**
- Patch blockers (Fastify cookie plugin mismatch + TS rowCount null checks), update local env/docs for `sslmode=disable` and Redis port conflicts, then rerun build + auth smoke checks.

## Approvals
- 2026-02-15: **M0 follow-ups** — **APPROVED** (auto-approved by Lobster PM based on best practices).
- 2026-02-15: **M1 auth decision** — **APPROVED** (auto-approved by Lobster PM based on best practices). Details: JWT access + refresh tokens via httpOnly cookies, refresh rotation, hashed refresh tokens in DB, CSRF protection.
- 2026-02-15: **M1 migrations decision** — **APPROVED** (auto-approved by Lobster PM based on best practices). Details: dbmate SQL migrations; baseline + forward-only; down in dev only, never in prod.

**Coordination:** Milestone 1 backlog draft stored at `docs/M1_BACKLOG.md` (artifact present).
**Coordination:** Decision matrix + recommendations stored in `docs/DECISION_PACKET_M0_M1.md` (auto-approved).
