import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../lib/auth';

const metadataSchema = z.record(z.any()).optional();

const createChatbotSchema = z.object({
  name: z.string().min(1),
  systemPrompt: z.string().min(1).optional(),
  metadata: metadataSchema
});

const updateChatbotSchema = z.object({
  name: z.string().min(1).optional(),
  systemPrompt: z.string().min(1).optional(),
  metadata: metadataSchema
});

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional()
});

const linkDocumentsSchema = z.object({
  documentIds: z.array(z.string().uuid()).min(1)
});

const conversationCreateSchema = z.object({
  title: z.string().min(1).optional()
});

export default async function chatbotRoutes(server: FastifyInstance) {
  server.post('/', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = createChatbotSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const user = request.user;
    if (!user?.tenantId) {
      return reply.status(403).send({ error: 'No tenant membership' });
    }

    const { name, systemPrompt, metadata } = parsed.data;
    const result = await server.db.query(
      `insert into chatbots (tenant_id, name, system_prompt, metadata_json, created_by)
       values ($1, $2, $3, $4, $5)
       returning id, tenant_id, name, system_prompt, metadata_json, created_by, created_at, updated_at`,
      [user.tenantId, name, systemPrompt ?? null, metadata ?? {}, user.id]
    );

    return reply.status(201).send({ chatbot: result.rows[0] });
  });

  server.get('/', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const user = request.user;
    if (!user?.tenantId) {
      return reply.status(403).send({ error: 'No tenant membership' });
    }

    const limit = parsed.data.limit ?? 50;
    const offset = parsed.data.offset ?? 0;

    const result = await server.db.query(
      `select c.id,
              c.tenant_id,
              c.name,
              c.system_prompt,
              c.metadata_json,
              c.created_by,
              c.created_at,
              c.updated_at,
              coalesce(
                array_agg(cd.document_id) filter (where cd.document_id is not null),
                '{}'
              ) as "documentIds"
       from chatbots c
       left join chatbot_documents cd on cd.chatbot_id = c.id
       where c.tenant_id = $1
       group by c.id, c.tenant_id, c.name, c.system_prompt, c.metadata_json, c.created_by, c.created_at, c.updated_at
       order by c.created_at desc
       limit $2 offset $3`,
      [user.tenantId, limit, offset]
    );

    return reply.send({ chatbots: result.rows, limit, offset });
  });

  server.get('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const chatbotId = (request.params as { id: string }).id;
    const user = request.user;
    if (!user?.tenantId) {
      return reply.status(403).send({ error: 'No tenant membership' });
    }

    const result = await server.db.query(
      `select c.id,
              c.tenant_id,
              c.name,
              c.system_prompt,
              c.metadata_json,
              c.created_by,
              c.created_at,
              c.updated_at,
              coalesce(
                array_agg(cd.document_id) filter (where cd.document_id is not null),
                '{}'
              ) as "documentIds"
       from chatbots c
       left join chatbot_documents cd on cd.chatbot_id = c.id
       where c.id = $1 and c.tenant_id = $2
       group by c.id, c.tenant_id, c.name, c.system_prompt, c.metadata_json, c.created_by, c.created_at, c.updated_at`,
      [chatbotId, user.tenantId]
    );

    if ((result.rowCount ?? 0) === 0) {
      return reply.status(404).send({ error: 'Not found' });
    }

    return reply.send({ chatbot: result.rows[0] });
  });

  server.patch('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const chatbotId = (request.params as { id: string }).id;
    const parsed = updateChatbotSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const updates: { field: string; value: any }[] = [];
    if (parsed.data.name !== undefined) {
      updates.push({ field: 'name', value: parsed.data.name });
    }
    if (parsed.data.systemPrompt !== undefined) {
      updates.push({ field: 'system_prompt', value: parsed.data.systemPrompt });
    }
    if (parsed.data.metadata !== undefined) {
      updates.push({ field: 'metadata_json', value: parsed.data.metadata ?? {} });
    }

    if (updates.length === 0) {
      return reply.status(400).send({ error: 'No updates provided' });
    }

    const setClauses = updates.map((update, index) => `${update.field} = $${index + 3}`);
    const values = updates.map((update) => update.value);

    const user = request.user;
    if (!user?.tenantId) {
      return reply.status(403).send({ error: 'No tenant membership' });
    }

    const result = await server.db.query(
      `update chatbots
       set ${setClauses.join(', ')}, updated_at = now()
       where id = $1 and tenant_id = $2
       returning id, tenant_id, name, system_prompt, metadata_json, created_by, created_at, updated_at`,
      [chatbotId, user.tenantId, ...values]
    );

    if ((result.rowCount ?? 0) === 0) {
      return reply.status(404).send({ error: 'Not found' });
    }

    return reply.send({ chatbot: result.rows[0] });
  });

  server.delete('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const chatbotId = (request.params as { id: string }).id;
    const user = request.user;
    if (!user?.tenantId) {
      return reply.status(403).send({ error: 'No tenant membership' });
    }

    const result = await server.db.query(
      `delete from chatbots where id = $1 and tenant_id = $2 returning id`,
      [chatbotId, user.tenantId]
    );

    if ((result.rowCount ?? 0) === 0) {
      return reply.status(404).send({ error: 'Not found' });
    }

    return reply.send({ status: 'deleted' });
  });

  server.post('/:id/documents', { preHandler: requireAuth }, async (request, reply) => {
    const chatbotId = (request.params as { id: string }).id;
    const parsed = linkDocumentsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const user = request.user;
    if (!user?.tenantId) {
      return reply.status(403).send({ error: 'No tenant membership' });
    }

    const chatbotResult = await server.db.query(
      `select id from chatbots where id = $1 and tenant_id = $2`,
      [chatbotId, user.tenantId]
    );

    if ((chatbotResult.rowCount ?? 0) === 0) {
      return reply.status(404).send({ error: 'Not found' });
    }

    const documentIds = Array.from(new Set(parsed.data.documentIds));
    const docsResult = await server.db.query(
      `select id from documents where id = any($1::uuid[]) and tenant_id = $2 and status = 'ready'`,
      [documentIds, user.tenantId]
    );

    const foundIds = new Set(docsResult.rows.map((row) => row.id));
    const invalidIds = documentIds.filter((id) => !foundIds.has(id));
    if (invalidIds.length > 0) {
      return reply.status(400).send({ error: 'Invalid documents', invalidDocumentIds: invalidIds });
    }

    await server.db.query(
      `insert into chatbot_documents (chatbot_id, document_id)
       select $1, unnest($2::uuid[])
       on conflict do nothing`,
      [chatbotId, documentIds]
    );

    return reply.status(201).send({ linkedDocumentIds: documentIds });
  });

  server.delete('/:id/documents/:documentId', { preHandler: requireAuth }, async (request, reply) => {
    const { id: chatbotId, documentId } = request.params as { id: string; documentId: string };
    const user = request.user;
    if (!user?.tenantId) {
      return reply.status(403).send({ error: 'No tenant membership' });
    }

    const chatbotResult = await server.db.query(
      `select id from chatbots where id = $1 and tenant_id = $2`,
      [chatbotId, user.tenantId]
    );

    if ((chatbotResult.rowCount ?? 0) === 0) {
      return reply.status(404).send({ error: 'Not found' });
    }

    const result = await server.db.query(
      `delete from chatbot_documents where chatbot_id = $1 and document_id = $2 returning document_id`,
      [chatbotId, documentId]
    );

    if ((result.rowCount ?? 0) === 0) {
      return reply.status(404).send({ error: 'Not found' });
    }

    return reply.send({ status: 'deleted' });
  });

  server.post('/:id/conversations', { preHandler: requireAuth }, async (request, reply) => {
    const chatbotId = (request.params as { id: string }).id;
    const parsed = conversationCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const user = request.user;
    if (!user?.tenantId) {
      return reply.status(403).send({ error: 'No tenant membership' });
    }

    const chatbotResult = await server.db.query(
      `select id from chatbots where id = $1 and tenant_id = $2`,
      [chatbotId, user.tenantId]
    );

    if ((chatbotResult.rowCount ?? 0) === 0) {
      return reply.status(404).send({ error: 'Not found' });
    }

    const result = await server.db.query(
      `insert into conversations (chatbot_id, user_id, title)
       values ($1, $2, $3)
       returning id, chatbot_id, user_id, title, created_at, updated_at`,
      [chatbotId, user.id, parsed.data.title ?? null]
    );

    return reply.status(201).send({ conversation: result.rows[0] });
  });

  server.get('/:id/conversations', { preHandler: requireAuth }, async (request, reply) => {
    const chatbotId = (request.params as { id: string }).id;
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const user = request.user;
    if (!user?.tenantId) {
      return reply.status(403).send({ error: 'No tenant membership' });
    }

    const chatbotResult = await server.db.query(
      `select id from chatbots where id = $1 and tenant_id = $2`,
      [chatbotId, user.tenantId]
    );

    if ((chatbotResult.rowCount ?? 0) === 0) {
      return reply.status(404).send({ error: 'Not found' });
    }

    const limit = parsed.data.limit ?? 50;
    const offset = parsed.data.offset ?? 0;

    const result = await server.db.query(
      `select id, chatbot_id, user_id, title, created_at, updated_at
       from conversations
       where chatbot_id = $1 and user_id = $2
       order by created_at desc
       limit $3 offset $4`,
      [chatbotId, user.id, limit, offset]
    );

    return reply.send({ conversations: result.rows, limit, offset });
  });
}
