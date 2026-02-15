# Milestone 1 Backlog — Auth, Tenancy, RBAC

**Status:** Draft (pending approvals in `PROJECT_STATUS.md`)

## Goal
Enable user registration/login and tenant isolation with RBAC, per SRS v1 and the approved M1 auth/migrations decisions.

## Inputs & Assumptions
- **Auth:** JWT access + refresh tokens via **httpOnly cookies**, **refresh rotation**, **hashed refresh tokens in DB**, **CSRF protection**, cookie-based session alignment.
- **Users:** Internal multi-tenant users (email/password) with **password complexity** + **email verification** + **tenant invitations**.
- **Migrations:** **dbmate**, SQL-first migrations; **baseline + forward-only**; down migrations only in dev with guardrails.

## Dependencies / Blockers
- Approvals recorded in `PROJECT_STATUS.md` (M0 follow-ups + M1 auth/migrations decisions).
- Email delivery mechanism available for verification/invites (can be stubbed in dev). 

## Out of Scope (M1)
- SSO / external IdP
- MFA
- Frontend UI (handled in M4)
- Advanced org management (teams, SCIM, etc.)

---

## Epic 1.1 — Auth & Sessions

### Story 1.1.1 — User Registration + Password Policy + Email Verification
**Acceptance:** User can register, receives verification email, cannot log in until verified.

**Tasks**
- Define password policy (min length, complexity, lockout rules) and update docs.
- Create DB schema for users (email, password_hash, status/verified_at, tenant_id, roles).
- Implement registration endpoint (`POST /auth/register`).
- Implement email verification token flow (generate, store hash + expiry).
- Implement verification endpoint (`GET/POST /auth/verify`).
- Add audit logs for auth events (optional but recommended).
- Unit/integration tests for registration + verification.

### Story 1.1.2 — Login/Logout + Secure Sessions
**Acceptance:** Valid creds create session; logout invalidates session.

**Tasks**
- Implement login endpoint (`POST /auth/login`) issuing access + refresh cookies.
- Implement refresh rotation (`POST /auth/refresh`) with hashed refresh tokens.
- Implement logout endpoint (`POST /auth/logout`) invalidating refresh token.
- Implement CSRF protection (double-submit or SameSite strategy).
- Cookie settings: httpOnly, secure, sameSite, path, TTL.
- Tests for refresh rotation, token reuse detection, logout.

---

## Epic 1.2 — Tenants & RBAC

### Story 1.2.1 — Tenant Creation on First Login
**Acceptance:** First login prompts tenant creation; tenant is persisted.

**Tasks**
- DB schema: tenants table, user ↔ tenant relationship.
- Implement tenant creation endpoint and link to first user.
- Enforce tenant context on auth/session (current_tenant_id).
- Add guardrails for one-user-per-tenant initial creation.
- Tests for tenant creation flow.

### Story 1.2.2 — Role Model (Admin/Member) Enforcement
**Acceptance:** API rejects cross-tenant access; role checks enforced.

**Tasks**
- Define roles enum + role assignment in DB.
- Implement RBAC middleware/guards.
- Add tenant scoping to all relevant queries.
- Audit tests for cross-tenant access rejection.

### Story 1.2.3 — User Invitation Flow
**Acceptance:** Admin invites by email; invited user joins tenant on signup.

**Tasks**
- Create invitations table (token hash, tenant_id, email, role, expiry).
- Implement invite endpoints (`POST /tenants/:id/invite`, `POST /auth/accept-invite`).
- Email invite sender + link.
- Implement signup path with invitation token.
- Tests for invite acceptance + expiry.

---

## Epic 1.3 — Migrations & Data Model

### Story 1.3.1 — dbmate Setup + Baseline
**Acceptance:** Migrations run in dev; baseline applied; forward-only in prod.

**Tasks**
- Add dbmate configuration + scripts (dev/prod).
- Create baseline migration (schema for auth + tenants + invites + refresh tokens).
- Add guardrails: prevent down migrations in prod.
- Update docs/DEVELOPMENT.md with migration workflow.

---

## Epic 1.4 — API/Worker Integration + Testing

### Story 1.4.1 — API Integration + Middleware
**Acceptance:** Auth middleware working; tenant scoping enforced.

**Tasks**
- Add auth/tenant middleware in API routes.
- Add request context (user, tenant, roles).
- Add validation schemas for auth endpoints.
- Add rate limiting for auth endpoints.

### Story 1.4.2 — Test Coverage
**Acceptance:** Integration tests cover core auth/tenant flows.

**Tasks**
- Add auth e2e tests (register → verify → login → refresh → logout).
- Add invitation flow tests.
- Add tenant + RBAC tests.

---

## Definition of Done (M1)
- All stories above meet acceptance criteria.
- Lint/build/tests green.
- Docs updated (auth flows, migration workflow, env vars).
- Security checks: password policy, secure cookies, CSRF protection.

## Tracking Notes
- Align with SRS v1: FR-1..FR-7, AC-1.
- Record approvals in `PROJECT_STATUS.md` before execution.
