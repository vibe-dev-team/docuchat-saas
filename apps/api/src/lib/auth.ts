import { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '@docuchat/config';
import { verifyAccessToken } from './jwt';

const csrfSafeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

export const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
  const accessToken = request.cookies[env.auth.accessCookieName];
  if (!accessToken) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  try {
    const payload = await verifyAccessToken(accessToken);
    request.user = {
      id: payload.sub,
      tenantId: payload.tid,
      role: payload.role
    };
  } catch {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  if (!csrfSafeMethods.has(request.method)) {
    const csrfCookie = request.cookies[env.auth.csrfCookieName];
    const csrfHeader = request.headers['x-csrf-token'];
    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      return reply.status(403).send({ error: 'Invalid CSRF token' });
    }
  }
};

export const requireRole = (roles: string[]) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
    if (!roles.includes(request.user.role)) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
  };
};
