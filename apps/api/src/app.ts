import Fastify, { FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import helmet from '@fastify/helmet';
import { decodeJwt } from 'jose';
import { env } from '@docuchat/config';
import { createPool } from '@docuchat/db';
import authRoutes from './routes/auth';

export const buildServer = () => {
  const server = Fastify({
    logger: { level: env.apiLogLevel },
    bodyLimit: env.apiBodyLimitBytes,
    trustProxy: env.apiTrustProxy
  });

  const pool = createPool(env.databaseUrl);
  server.decorate('db', pool);

  const devOriginMatchers = [/^http://localhost:\d+$/, /^http://127\.0\.0\.1:\d+$/];
  const cspAllowedOrigins = env.security.cspAllowedOrigins;
  const corsAllowedOrigins =
    env.security.corsAllowedOrigins.length > 0 ? env.security.corsAllowedOrigins : cspAllowedOrigins;
  const cspScriptSrc = ["'self'", ...cspAllowedOrigins];
  const cspStyleSrc = ["'self'", "'unsafe-inline'", ...cspAllowedOrigins];
  const cspImgSrc = ["'self'", 'data:', ...cspAllowedOrigins];
  const cspFontSrc = ["'self'", 'data:', ...cspAllowedOrigins];
  const cspConnectSrc = ["'self'", ...cspAllowedOrigins];
  const cspFrameSrc = ["'self'", ...cspAllowedOrigins];

  const buildRateLimitKey = (request: FastifyRequest) => {
    const parts: string[] = [request.ip ?? 'unknown'];
    let tenantId = request.user?.tenantId ?? undefined;
    let userId = request.user?.id ?? undefined;
    if ((!tenantId || !userId) && request.cookies?.[env.auth.accessCookieName]) {
      try {
        const token = request.cookies[env.auth.accessCookieName];
        if (typeof token === 'string' && token.length > 0) {
          const decoded = decodeJwt(token) as { sub?: string; tid?: string };
          tenantId = tenantId ?? decoded.tid;
          userId = userId ?? decoded.sub;
        }
      } catch {
        // ignore decode failures for rate-limit keying
      }
    }
    if (tenantId) {
      parts.push('tenant:' + tenantId);
    }
    if (userId) {
      parts.push('user:' + userId);
    }
    return parts.join('|');
  };

  server.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        scriptSrc: cspScriptSrc,
        styleSrc: cspStyleSrc,
        imgSrc: cspImgSrc,
        fontSrc: cspFontSrc,
        connectSrc: cspConnectSrc,
        frameSrc: cspFrameSrc
      }
    }
  });

  server.register(cors, {
    credentials: true,
    allowedHeaders: ['content-type', 'authorization', 'x-csrf-token'],
    origin: (origin, cb) => {
      if (!origin) {
        cb(null, true);
        return;
      }
      if (env.nodeEnv !== 'production' && devOriginMatchers.some((matcher) => matcher.test(origin))) {
        cb(null, true);
        return;
      }
      if (corsAllowedOrigins.includes(origin)) {
        cb(null, true);
        return;
      }
      cb(new Error('Not allowed by CORS'), false);
    }
  });

  server.register(cookie);
  server.register(rateLimit, {
    max: env.rateLimit.max,
    timeWindow: env.rateLimit.windowMs,
    keyGenerator: buildRateLimitKey
  });

  server.get('/health', async () => {
    return { status: 'ok' };
  });

  server.register(authRoutes, { prefix: '/auth' });

  server.addHook('onClose', async () => {
    await pool.end();
  });

  return server;
};
