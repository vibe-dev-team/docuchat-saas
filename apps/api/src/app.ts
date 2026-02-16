import Fastify from 'fastify';
import cookie from '@fastify/cookie';
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

  server.register(cookie);

  server.get('/health', async () => {
    return { status: 'ok' };
  });

  server.register(authRoutes, { prefix: '/auth' });

  server.addHook('onClose', async () => {
    await pool.end();
  });

  return server;
};
