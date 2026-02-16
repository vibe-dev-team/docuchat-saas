import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../lib/auth';

const uploadFieldSchema = z.object({
  title: z.string().min(1).optional()
});

const getTitle = (fields: Record<string, any> | undefined, fallback: string) => {
  const raw = fields?.title?.value ?? fields?.title;
  const parsed = uploadFieldSchema.safeParse({ title: raw });
  if (parsed.success && parsed.data.title) {
    return parsed.data.title;
  }
  return fallback;
};

export default async function documentRoutes(server: FastifyInstance) {
  server.post('/tenants/:tenantId/upload', { preHandler: requireAuth }, async (request, reply) => {
    const tenantId = (request.params as { tenantId: string }).tenantId;
    if (request.user?.tenantId !== tenantId) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const file = await request.file();
    if (!file) {
      return reply.status(400).send({ error: 'File required' });
    }

    if (!file.mimetype?.includes('pdf')) {
      return reply.status(400).send({ error: 'Only PDF uploads are supported' });
    }

    const buffer = await file.toBuffer();
    if (buffer.length > 50 * 1024 * 1024) {
      return reply.status(413).send({ error: 'File too large (max 50MB)' });
    }

    const title = getTitle(file.fields as Record<string, any>, file.filename || 'Untitled document');

    const result = await server.db.query(
      `insert into documents (tenant_id, title, status, created_by)
       values ($1, $2, $3, $4)
       returning id`,
      [tenantId, title, 'ready', request.user?.id ?? null]
    );

    const documentId = result.rows[0]?.id;

    return reply.status(201).send({
      documentId,
      status: 'ready'
    });
  });
}
