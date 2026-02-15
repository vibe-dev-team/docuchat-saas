# Decision-Capture Packet: M0 Follow-ups + M1 Auth/Migrations

**Purpose:** Obtain explicit approvals to (1) complete M0 follow-ups and (2) lock M1 auth/migrations decisions so we can move the backlog forward.

## Concise Approval Request (copy/paste)

> Please confirm approval for the **M0 follow-ups** and the **M1 auth/migrations decisions** listed below. A simple “Approved” (or specific changes) is sufficient. Once approved, I’ll update `PROJECT_STATUS.md` and move to the M1 backlog.

---

## Decision Checklist

### A) M0 Follow-ups (approval to proceed)
- [ ] **CI smoke step** is accepted as the M0 verification baseline (boots services + `npm run smoke:boot`).
- [ ] **Env loading strategy** in `@docuchat/config` is accepted (search `.env`/`.env.local` or `DOCUCHAT_ENV_FILE`).
- [ ] **Turbo v2 + ESLint flat config** changes are accepted.
- [ ] **Queue helpers / worker heartbeat** implementation is accepted.

### B) M1 Auth/Migrations Decisions (approval to lock)

#### Decision Matrix

**1) Auth approach**

| Option | Pros | Cons | Fit for M1 |
| --- | --- | --- | --- |
| **JWT access + refresh tokens (httpOnly cookies)** | Stateless API, scales well; works with SPA; minimal infra | Requires refresh rotation + token revocation handling; CSRF considerations | **High** (simple + scalable) |
| **Server-side sessions (Redis)** | Easy revocation; simpler security model | Requires Redis session store + sticky logic; more infra | Medium |
| **External IdP (Auth0/Clerk/etc.)** | Fast to ship auth UI + MFA; offloads security | Vendor lock-in, cost, integration time | Low for M1 (unless already committed) |

**Recommendation:** **JWT access + refresh tokens** using **httpOnly cookies**, **refresh rotation**, and **hashed refresh tokens** stored in DB for revocation. Add CSRF protection (double-submit or SameSite strict/lax, depending on UI flow). **Align session handling with cookie-based flows** (access/refresh token cookies as the single session source of truth).

---

**2) User identity source**

| Option | Pros | Cons | Fit for M1 |
| --- | --- | --- | --- |
| **Internal multi-tenant users (email/password)** | Matches SRS/user stories; full control | Must implement email verification + password policy | **High** |
| External users/SSO only | Works for enterprise SSO | Doesn’t match SRS registration/invite flow | Low |
| Hybrid (internal + SSO) | Flexible | More complexity and scope | Medium (post-M1) |

**Recommendation:** **Internal multi-tenant users** with email/password, **password complexity policy**, email verification, and tenant invitations (aligned to SRS requirements).

---

**3) Migrations tooling**

| Option | Pros | Cons | Fit for M1 |
| --- | --- | --- | --- |
| **dbmate (SQL migrations)** | Simple, DB-native; great with pgvector; no ORM | SQL-only; fewer TS helpers | **High** |
| **node-pg-migrate** | JS/TS migrations; integrates with pg | Slightly heavier setup; less DB-native | Medium |
| Prisma/Drizzle migrations | Strong tooling + type safety | Requires ORM adoption (not present today) | Low |

**Recommendation:** **dbmate** for SQL-first migrations (matches current pg usage and keeps tooling minimal).

---

**4) Migration strategy**

| Option | Pros | Cons | Fit for M1 |
| --- | --- | --- | --- |
| **Baseline + forward-only; no down in prod** | Safe for production; clear history | Requires new up migration to revert | **High** |
| Allow down migrations in dev only | Faster local iteration | Risk if used in prod | Medium |
| Full up/down in all envs | Flexible | Risky; higher maintenance | Low |

**Recommendation:** **Baseline + forward-only** (no down migrations in prod). Allow down migrations in dev **only** with guardrails.

---

#### Recommended M1 Approvals (copy/paste)
- [ ] **Auth approach:** JWT access + refresh tokens (httpOnly cookies), refresh rotation, hashed refresh tokens in DB, CSRF protection, **cookie-based session alignment**.
- [ ] **User identity source:** Internal multi-tenant users (email/password + **password complexity policy** + verification + invitations).
- [ ] **Migrations tooling:** dbmate (SQL-first migrations).
- [ ] **Migration strategy:** Baseline + forward-only; down migrations only in dev (guardrails), never in prod.

> If any item needs changes, mark it and note the revision.

---

## Recommended place to record approvals

Add a dedicated **“Approvals”** section in `PROJECT_STATUS.md` under **Blocker** or **Coordination**, e.g.:

```md
## Approvals
- 2026-02-15: M0 follow-ups — APPROVED by <name>
- 2026-02-15: M1 auth decision — APPROVED by <name> (details: ...)
- 2026-02-15: M1 migrations decision — APPROVED by <name> (details: ...)
```

This keeps the approval state explicit and timestamped.

---

## Auto-approval decision (2026-02-15)
The following defaults were auto-approved by Lobster PM based on best practices:
- **Auth:** JWT access + refresh tokens in **httpOnly cookies**, refresh rotation, hashed refresh tokens in DB, CSRF protection.
- **Users:** Internal multi-tenant users (email/password), password complexity, email verification, tenant invitations.
- **Migrations tooling:** **dbmate** (SQL-first migrations).
- **Migration strategy:** Baseline + forward-only; **down migrations only in dev**, never in prod.
