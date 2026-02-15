import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { env } from '@docuchat/config';
import { generateToken, hashTokenWithSecret } from '../lib/crypto';
import { signAccessToken } from '../lib/jwt';
import { hashPassword, validatePassword, verifyPassword } from '../lib/password';
import { sendMail } from '../lib/mailer';
import { requireAuth, requireRole } from '../lib/auth';

const EMAIL_VERIFICATION_TTL_SECONDS = 60 * 60 * 24;
const PASSWORD_RESET_TTL_SECONDS = 60 * 60 * 2;
const INVITE_TTL_SECONDS = 60 * 60 * 24 * 7;

const ROLE_OWNER = 'owner';
const ROLE_ADMIN = 'admin';
const ROLE_MEMBER = 'member';

const slugify = (value: string) => {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
};

const setAuthCookies = (
  reply: any,
  accessToken: string,
  refreshToken: string,
  csrfToken: string,
) => {
  const baseOptions = {
    path: '/',
    secure: env.auth.secureCookies,
    sameSite: 'lax' as const,
    domain: env.auth.cookieDomain
  };

  reply.setCookie(env.auth.accessCookieName, accessToken, {
    ...baseOptions,
    httpOnly: true,
    maxAge: env.auth.accessTokenTtlSeconds
  });

  reply.setCookie(env.auth.refreshCookieName, refreshToken, {
    ...baseOptions,
    httpOnly: true,
    maxAge: env.auth.refreshTokenTtlSeconds
  });

  reply.setCookie(env.auth.csrfCookieName, csrfToken, {
    ...baseOptions,
    httpOnly: false,
    maxAge: env.auth.refreshTokenTtlSeconds
  });
};

const clearAuthCookies = (reply: any) => {
  const baseOptions = {
    path: '/',
    secure: env.auth.secureCookies,
    sameSite: 'lax' as const,
    domain: env.auth.cookieDomain
  };

  reply.clearCookie(env.auth.accessCookieName, baseOptions);
  reply.clearCookie(env.auth.refreshCookieName, baseOptions);
  reply.clearCookie(env.auth.csrfCookieName, baseOptions);
};

const requireCsrf = (request: any, reply: any) => {
  const csrfCookie = request.cookies[env.auth.csrfCookieName];
  const csrfHeader = request.headers['x-csrf-token'];
  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    reply.status(403).send({ error: 'Invalid CSRF token' });
    return false;
  }
  return true;
};

const createEmailVerificationToken = async (
  server: FastifyInstance,
  userId: string,
  email: string,
) => {
  const token = generateToken();
  const tokenHash = hashTokenWithSecret(token, env.auth.refreshTokenSecret);
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_SECONDS * 1000);

  await server.db.query(
    `insert into email_verification_tokens (user_id, token_hash, expires_at)
     values ($1, $2, $3)`,
    [userId, tokenHash, expiresAt],
  );

  const link = `${env.auth.appBaseUrl}/verify-email?token=${token}`;
  await sendMail({
    to: email,
    subject: 'Verify your DocuChat email',
    text: `Verify your email by visiting: ${link}`
  });
};

const createPasswordResetToken = async (
  server: FastifyInstance,
  userId: string,
  email: string,
) => {
  const token = generateToken();
  const tokenHash = hashTokenWithSecret(token, env.auth.refreshTokenSecret);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_SECONDS * 1000);

  await server.db.query(
    `insert into password_reset_tokens (user_id, token_hash, expires_at)
     values ($1, $2, $3)`,
    [userId, tokenHash, expiresAt],
  );

  const link = `${env.auth.appBaseUrl}/reset-password?token=${token}`;
  await sendMail({
    to: email,
    subject: 'Reset your DocuChat password',
    text: `Reset your password by visiting: ${link}`
  });
};

const createRefreshToken = async (
  server: FastifyInstance,
  userId: string,
  requestMeta: { ip?: string; userAgent?: string },
) => {
  const token = generateToken(64);
  const tokenHash = hashTokenWithSecret(token, env.auth.refreshTokenSecret);
  const expiresAt = new Date(Date.now() + env.auth.refreshTokenTtlSeconds * 1000);

  const result = await server.db.query(
    `insert into auth_refresh_tokens (user_id, token_hash, expires_at, created_by_ip, user_agent)
     values ($1, $2, $3, $4, $5)
     returning id`,
    [userId, tokenHash, expiresAt, requestMeta.ip, requestMeta.userAgent],
  );

  return { token, tokenHash, id: result.rows[0].id, expiresAt };
};

const revokeUserRefreshTokens = async (server: FastifyInstance, userId: string, ip?: string) => {
  await server.db.query(
    `update auth_refresh_tokens
     set revoked_at = now(), revoked_by_ip = $2
     where user_id = $1 and revoked_at is null`,
    [userId, ip ?? null],
  );
};

const issueSession = async (server: FastifyInstance, user: { id: string; tenantId: string; role: string }, request: any, reply: any) => {
  const accessToken = await signAccessToken({
    sub: user.id,
    tid: user.tenantId,
    role: user.role
  });

  const refreshToken = await createRefreshToken(server, user.id, {
    ip: request.ip,
    userAgent: request.headers['user-agent']
  });

  const csrfToken = generateToken(32);
  setAuthCookies(reply, accessToken, refreshToken.token, csrfToken);

  return { accessToken, refreshTokenId: refreshToken.id, csrfToken };
};

const registerSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1),
  tenantName: z.string().min(1).optional(),
  inviteToken: z.string().min(1).optional()
});

const loginSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1)
});

const verifySchema = z.object({
  token: z.string().min(1)
});

const forgotSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase())
});

const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(1)
});

const inviteSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  role: z.enum([ROLE_OWNER, ROLE_ADMIN, ROLE_MEMBER])
});

const acceptInviteSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1),
  inviteToken: z.string().min(1)
});

const getMembership = async (server: FastifyInstance, userId: string) => {
  const result = await server.db.query(
    `select tenant_id, role from tenant_memberships where user_id = $1 order by created_at asc limit 1`,
    [userId],
  );
  return result.rows[0];
};

export default async function authRoutes(server: FastifyInstance) {
  server.post('/register', async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { email, password, tenantName, inviteToken } = parsed.data;
    const passwordError = validatePassword(password, env.auth.passwordMinLength);
    if (passwordError) {
      return reply.status(400).send({ error: passwordError });
    }

    const existingUser = await server.db.query('select id from users where email = $1', [email]);
    const existingCount = existingUser.rowCount ?? 0;
    if (existingCount > 0) {
      return reply.status(409).send({ error: 'Email already registered' });
    }

    const client = await server.db.connect();
    try {
      await client.query('begin');

      let tenantId: string | undefined;
      let role = ROLE_OWNER;

      if (inviteToken) {
        const inviteHash = hashTokenWithSecret(inviteToken, env.auth.refreshTokenSecret);
        const inviteResult = await client.query(
          `select id, tenant_id, role, email, expires_at, accepted_at
           from invitations
           where token_hash = $1`,
          [inviteHash],
        );

        const invite = inviteResult.rows[0];
        if (!invite || invite.accepted_at || new Date(invite.expires_at) < new Date()) {
          await client.query('rollback');
          return reply.status(400).send({ error: 'Invalid invite token' });
        }
        if (invite.email !== email) {
          await client.query('rollback');
          return reply.status(400).send({ error: 'Invite email mismatch' });
        }

        tenantId = invite.tenant_id;
        role = invite.role;
        await client.query(
          `update invitations set accepted_at = now() where id = $1`,
          [invite.id],
        );
      } else {
        const rawName = tenantName ?? 'My Workspace';
        let slug = slugify(rawName) || 'workspace';

        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            const tenantResult = await client.query(
              `insert into tenants (name, slug)
               values ($1, $2)
               returning id`,
              [rawName, slug],
            );
            tenantId = tenantResult.rows[0].id;
            break;
          } catch (err: any) {
            if (err?.code === '23505') {
              slug = `${slug}-${Math.floor(Math.random() * 1000)}`;
            } else {
              throw err;
            }
          }
        }

        if (!tenantId) {
          throw new Error('Failed to create tenant');
        }
      }

      const passwordHash = await hashPassword(password);
      const userResult = await client.query(
        `insert into users (email, password_hash)
         values ($1, $2)
         returning id`,
        [email, passwordHash],
      );

      const userId = userResult.rows[0].id;

      await client.query(
        `insert into tenant_memberships (tenant_id, user_id, role)
         values ($1, $2, $3)`,
        [tenantId!, userId, role],
      );

      await client.query('commit');

      await createEmailVerificationToken(server, userId, email);

      return reply.status(201).send({ status: 'registered' });
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  });

  server.post('/verify-email', async (request, reply) => {
    const parsed = verifySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const tokenHash = hashTokenWithSecret(parsed.data.token, env.auth.refreshTokenSecret);
    const result = await server.db.query(
      `select id, user_id, expires_at, used_at
       from email_verification_tokens
       where token_hash = $1`,
      [tokenHash],
    );

    const token = result.rows[0];
    if (!token || token.used_at || new Date(token.expires_at) < new Date()) {
      return reply.status(400).send({ error: 'Invalid or expired token' });
    }

    await server.db.query(
      `update users set email_verified_at = now(), updated_at = now() where id = $1`,
      [token.user_id],
    );
    await server.db.query(
      `update email_verification_tokens set used_at = now() where id = $1`,
      [token.id],
    );

    return reply.send({ status: 'verified' });
  });

  server.post('/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { email, password } = parsed.data;
    const result = await server.db.query(
      `select id, password_hash, email_verified_at from users where email = $1`,
      [email],
    );

    const user = result.rows[0];
    if (!user) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    if (!user.email_verified_at) {
      return reply.status(403).send({ error: 'Email not verified' });
    }

    const validPassword = await verifyPassword(user.password_hash, password);
    if (!validPassword) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const membership = await getMembership(server, user.id);
    if (!membership) {
      return reply.status(403).send({ error: 'No tenant membership' });
    }

    await issueSession(
      server,
      { id: user.id, tenantId: membership.tenant_id, role: membership.role },
      request,
      reply,
    );

    return reply.send({ status: 'ok' });
  });

  server.post('/refresh', async (request, reply) => {
    if (!requireCsrf(request, reply)) {
      return;
    }

    const refreshToken = request.cookies[env.auth.refreshCookieName];
    if (!refreshToken) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const tokenHash = hashTokenWithSecret(refreshToken, env.auth.refreshTokenSecret);
    const result = await server.db.query(
      `select id, user_id, expires_at, revoked_at, replaced_by_id
       from auth_refresh_tokens where token_hash = $1`,
      [tokenHash],
    );

    const tokenRow = result.rows[0];
    if (!tokenRow) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    if (tokenRow.revoked_at) {
      await revokeUserRefreshTokens(server, tokenRow.user_id, request.ip);
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    if (new Date(tokenRow.expires_at) < new Date()) {
      await server.db.query(
        `update auth_refresh_tokens set revoked_at = now(), revoked_by_ip = $2 where id = $1`,
        [tokenRow.id, request.ip],
      );
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const membership = await getMembership(server, tokenRow.user_id);
    if (!membership) {
      return reply.status(403).send({ error: 'No tenant membership' });
    }

    const newRefresh = await createRefreshToken(server, tokenRow.user_id, {
      ip: request.ip,
      userAgent: request.headers['user-agent']
    });

    await server.db.query(
      `update auth_refresh_tokens
       set revoked_at = now(), revoked_by_ip = $2, replaced_by_id = $3
       where id = $1`,
      [tokenRow.id, request.ip, newRefresh.id],
    );

    const accessToken = await signAccessToken({
      sub: tokenRow.user_id,
      tid: membership.tenant_id,
      role: membership.role
    });

    const csrfToken = generateToken(32);
    setAuthCookies(reply, accessToken, newRefresh.token, csrfToken);

    return reply.send({ status: 'ok' });
  });

  server.post('/logout', async (request, reply) => {
    if (!requireCsrf(request, reply)) {
      return;
    }

    const refreshToken = request.cookies[env.auth.refreshCookieName];
    if (refreshToken) {
      const tokenHash = hashTokenWithSecret(refreshToken, env.auth.refreshTokenSecret);
      await server.db.query(
        `update auth_refresh_tokens set revoked_at = now(), revoked_by_ip = $2 where token_hash = $1`,
        [tokenHash, request.ip],
      );
    }
    clearAuthCookies(reply);
    return reply.send({ status: 'ok' });
  });

  server.post('/forgot-password', async (request, reply) => {
    const parsed = forgotSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { email } = parsed.data;
    const result = await server.db.query(
      `select id from users where email = $1`,
      [email],
    );

    const user = result.rows[0];
    if (user) {
      await createPasswordResetToken(server, user.id, email);
    }

    return reply.send({ status: 'ok' });
  });

  server.post('/reset-password', async (request, reply) => {
    const parsed = resetSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { token, password } = parsed.data;
    const passwordError = validatePassword(password, env.auth.passwordMinLength);
    if (passwordError) {
      return reply.status(400).send({ error: passwordError });
    }

    const tokenHash = hashTokenWithSecret(token, env.auth.refreshTokenSecret);
    const result = await server.db.query(
      `select id, user_id, expires_at, used_at
       from password_reset_tokens
       where token_hash = $1`,
      [tokenHash],
    );

    const row = result.rows[0];
    if (!row || row.used_at || new Date(row.expires_at) < new Date()) {
      return reply.status(400).send({ error: 'Invalid or expired token' });
    }

    const newHash = await hashPassword(password);
    await server.db.query(
      `update users set password_hash = $2, updated_at = now() where id = $1`,
      [row.user_id, newHash],
    );
    await server.db.query(
      `update password_reset_tokens set used_at = now() where id = $1`,
      [row.id],
    );
    await revokeUserRefreshTokens(server, row.user_id, request.ip);

    clearAuthCookies(reply);
    return reply.send({ status: 'ok' });
  });

  server.get('/me', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.user!;
    const result = await server.db.query(
      `select id, email, email_verified_at from users where id = $1`,
      [user.id],
    );
    return reply.send({
      user: {
        id: user.id,
        email: result.rows[0]?.email,
        emailVerifiedAt: result.rows[0]?.email_verified_at,
        tenantId: user.tenantId,
        role: user.role
      }
    });
  });

  server.post(
    '/tenants/:tenantId/invitations',
    { preHandler: [requireAuth, requireRole([ROLE_OWNER, ROLE_ADMIN])] },
    async (request, reply) => {
      const parsed = inviteSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }

      const tenantId = (request.params as { tenantId: string }).tenantId;
      if (request.user?.tenantId !== tenantId) {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      const token = generateToken();
      const tokenHash = hashTokenWithSecret(token, env.auth.refreshTokenSecret);
      const expiresAt = new Date(Date.now() + INVITE_TTL_SECONDS * 1000);

      await server.db.query(
        `insert into invitations (tenant_id, email, role, token_hash, expires_at)
         values ($1, $2, $3, $4, $5)`,
        [tenantId, parsed.data.email, parsed.data.role, tokenHash, expiresAt],
      );

      const link = `${env.auth.appBaseUrl}/accept-invite?token=${token}`;
      await sendMail({
        to: parsed.data.email,
        subject: 'You are invited to DocuChat',
        text: `Accept your invite: ${link}`
      });

      return reply.status(201).send({ status: 'sent' });
    },
  );

  server.post('/accept-invite', async (request, reply) => {
    const parsed = acceptInviteSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { email, password, inviteToken } = parsed.data;
    const passwordError = validatePassword(password, env.auth.passwordMinLength);
    if (passwordError) {
      return reply.status(400).send({ error: passwordError });
    }

    const existingUser = await server.db.query('select id from users where email = $1', [email]);
    const existingCount = existingUser.rowCount ?? 0;
    if (existingCount > 0) {
      return reply.status(409).send({ error: 'Email already registered' });
    }

    const client = await server.db.connect();
    try {
      await client.query('begin');

      const inviteHash = hashTokenWithSecret(inviteToken, env.auth.refreshTokenSecret);
      const inviteResult = await client.query(
        `select id, tenant_id, role, email, expires_at, accepted_at
         from invitations
         where token_hash = $1`,
        [inviteHash],
      );

      const invite = inviteResult.rows[0];
      if (!invite || invite.accepted_at || new Date(invite.expires_at) < new Date()) {
        await client.query('rollback');
        return reply.status(400).send({ error: 'Invalid invite token' });
      }
      if (invite.email !== email) {
        await client.query('rollback');
        return reply.status(400).send({ error: 'Invite email mismatch' });
      }

      const passwordHash = await hashPassword(password);
      const userResult = await client.query(
        `insert into users (email, password_hash)
         values ($1, $2)
         returning id`,
        [email, passwordHash],
      );

      const userId = userResult.rows[0].id;

      await client.query(
        `insert into tenant_memberships (tenant_id, user_id, role)
         values ($1, $2, $3)`,
        [invite.tenant_id, userId, invite.role],
      );

      await client.query(
        `update invitations set accepted_at = now() where id = $1`,
        [invite.id],
      );

      await client.query('commit');

      await createEmailVerificationToken(server, userId, email);

      return reply.status(201).send({ status: 'registered' });
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  });
}
