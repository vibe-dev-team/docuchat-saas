import 'fastify';
import { Pool } from 'pg';

declare module 'fastify' {
  interface FastifyInstance {
    db: Pool;
  }

  interface FastifyRequest {
    user?: {
      id: string;
      tenantId: string;
      role: string;
    };
  }
}
