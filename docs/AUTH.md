# Auth (M1)

## Overview
DocuChat uses JWT access tokens and refresh tokens stored in **httpOnly cookies**. Refresh tokens are **rotated** on every refresh and stored as **hashed values** in Postgres. CSRF protection uses a double-submit cookie.

## Cookies
- **Access token cookie**: short-lived JWT for API access.
- **Refresh token cookie**: long-lived random token for rotation.
- **CSRF cookie**: non-httpOnly token; send value in `x-csrf-token` header for mutating requests.

Cookie defaults are configured via `.env` (see `.env.example`).

## CSRF
For any authenticated request using **POST/PUT/PATCH/DELETE**, include:
```
x-csrf-token: <value from AUTH_CSRF_COOKIE_NAME cookie>
```

This also applies to **/auth/refresh** and **/auth/logout** (they rely on cookies).

## Auth endpoints
- `POST /auth/register` — register a user and tenant (or invite).
- `POST /auth/verify-email` — verify email token.
- `POST /auth/login` — issue access + refresh cookies.
- `POST /auth/refresh` — rotate refresh token and issue new cookies.
- `POST /auth/logout` — revoke refresh token and clear cookies.
- `POST /auth/forgot-password` — send password reset link.
- `POST /auth/reset-password` — reset password via token.
- `GET /auth/me` — authenticated user info.
- `POST /auth/tenants/:tenantId/invitations` — create invite (owner/admin).
- `POST /auth/accept-invite` — register using invite token.

## Email delivery
M1 uses a **logging stub** for email delivery. Token URLs are logged by the API. Replace with a real provider in later milestones.

## Roles
- **owner** — full access to tenant.
- **admin** — manage members/invites.
- **member** — standard access.
