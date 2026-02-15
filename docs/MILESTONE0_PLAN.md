# Milestone 0 Plan — Foundations & Infrastructure

**Objective:** Stand up the repo, core service skeletons, local dev dependencies, and CI quality gates needed to begin feature development.

## Ordered Checklist
1. **Repository scaffolding**
   - Create/confirm `apps/`, `packages/`, `docs/` layout.
   - Add base TypeScript configs (root `tsconfig`, per-app extends).
   - Add lint/format config (ESLint + Prettier) and root scripts.
2. **Turbo pipelines + workspace scripts**
   - Define `build`, `dev`, `lint`, `test` pipelines in `turbo.json`.
   - Ensure each app has `dev` + `build` scripts.
3. **CI pipeline**
   - Add PR workflow (GitHub Actions) that runs `npm ci`, `npm run lint`, `npm run build` (and `npm test` if present).
   - Mark CI checks as required.
4. **Environment + config validation**
   - Create `.env.example` with all required variables.
   - Implement config validation (e.g., Zod) for API and worker on boot.
5. **API service skeleton**
   - Initialize API app (framework-agnostic).
   - Add `/health` endpoint.
   - Add structured logging middleware.
6. **Worker service skeleton**
   - Initialize worker app.
   - Connect to queue (Redis/BullMQ or equivalent).
   - Log heartbeat every N seconds.
7. **Local dev dependencies**
   - Add `docker-compose.yml` for Postgres, Redis, and object storage (MinIO).
   - Configure API/worker to connect to local dependencies.
8. **Vector DB connectivity**
   - Choose dev target (pgvector in Postgres or external vector DB container).
   - Add connection test on boot.
9. **Developer documentation**
   - Document setup steps, required env vars, and common commands in README or `docs/`.

## Acceptance Criteria
- **Repo tooling:** `npm run lint` and `npm run format` succeed from repo root.
- **Turbo:** `npm run build` and `npm run dev` execute all configured apps without errors.
- **CI:** PR workflow runs lint + build (and tests if present) successfully.
- **Config validation:** Missing/invalid env vars fail fast with clear errors.
- **API health:** `/health` returns 200 and logs a request line.
- **Worker:** Connects to queue and logs heartbeat periodically.
- **Dependencies:** `docker compose up` starts Postgres/Redis/MinIO; API and worker can connect.
- **Vector DB:** Connection test logs success on boot.
- **Docs:** Setup guide explains env vars, local deps, and commands.
