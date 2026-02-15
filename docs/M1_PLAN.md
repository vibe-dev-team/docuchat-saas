# Milestone 1 Plan — Auth, Tenancy, RBAC

**Objective:** Deliver secure, cookie-based auth with tenant isolation, RBAC, and migrations per approved M1 decisions.

## Scope (In)
- JWT access + refresh cookies with rotation and hashed refresh tokens.
- CSRF protection and secure cookie policy.
- Internal users with password policy and email verification.
- Tenant creation, invitations, and Admin/Member RBAC.
- dbmate SQL migrations (baseline + forward-only; down migrations dev-only).
- API middleware and tests covering core flows.

## Out of Scope (M1)
- SSO / external IdP
- MFA
- Frontend UI (handled in M4)
- Advanced org management (teams, SCIM, etc.)

## Ordered Checklist
1. **Migrations + data model**
   - Add dbmate configuration + scripts.
   - Create baseline migration for users, tenants, roles, invites, refresh tokens.
   - Guardrails: prevent down migrations in prod.
2. **Auth flows**
   - Registration endpoint with password policy.
   - Email verification token flow (hashed token + expiry).
   - Login endpoint issuing access + refresh cookies.
   - Refresh rotation and reuse detection.
   - Logout invalidation.
   - CSRF strategy (double-submit or SameSite + token header).
3. **Tenancy + RBAC**
   - Tenant creation on first login.
   - Admin/Member role model.
   - Tenant scoping enforcement in API queries.
4. **Invitations**
   - Invitations table + endpoints.
   - Invite email sender (stubbed in dev).
   - Accept-invite flow tied to signup.
5. **API integration + middleware**
   - Auth/tenant middleware and request context.
   - Validation schemas for auth endpoints.
   - Rate limiting on auth endpoints.
6. **Tests**
   - Register → verify → login → refresh → logout.
   - Invitation flow tests.
   - Tenant scoping + RBAC tests.
7. **Documentation updates**
   - Auth flow docs (cookies, CSRF, rotation).
   - Migration workflow and commands.
   - Environment variables list.

## Acceptance Criteria
- Core auth flows work with secure cookies and rotation.
- Email verification required before login.
- Tenant isolation enforced; RBAC rejects cross-tenant access.
- dbmate migrations run cleanly in dev; forward-only in prod.
- Tests cover critical flows and pass in CI.
- Docs updated with auth + migration guidance.

## References
- M1 backlog: `docs/M1_BACKLOG.md`
- Decisions: `docs/DECISION_PACKET_M0_M1.md`
- SRS: `docs/SRS-v1.md`
