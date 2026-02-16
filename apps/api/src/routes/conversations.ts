import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../lib/auth';

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional()
});

const createMessageSchema = z.object({
  content: z.string().min(1)
});

const getConversation = async (server: FastifyInstance, conversationId: string) => {
  const result = await server.db.query(
    `select c.id,
            c.user_id,
            c.chatbot_id,
            cb.tenant_id
     from conversations c
     join chatbots cb on cb.id = c.chatbot_id
     where c.id = $1`,
    [conversationId]
  );
  return result.rows[0];
};

export default async function conversationRoutes(server: FastifyInstance) {
  server.get('/:id/messages', { preHandler: requireAuth }, async (request, reply) => {
    const conversationId = (request.params as { id: string }).id;
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const conversation = await getConversation(server, conversationId);
    if (!conversation) {
      return reply.status(404).send({ error: 'Not found' });
    }

    const user = request.user;
    if (!user?.tenantId) {
      return reply.status(403).send({ error: 'No tenant membership' });
    }

    if (conversation.tenant_id !== user.tenantId || conversation.user_id !== user.id) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const limit = parsed.data.limit ?? 100;
    const offset = parsed.data.offset ?? 0;
    const result = await server.db.query(
      `select id, conversation_id, sender, content, citations_json, created_at
       from messages
       where conversation_id = $1
       order by created_at asc
       limit $2 offset $3`,
      [conversationId, limit, offset]
    );

    return reply.send({ messages: result.rows, limit, offset });
  });

  server.post('/:id/messages', { preHandler: requireAuth }, async (request, reply) => {
    const conversationId = (request.params as { id: string }).id;
    const parsed = createMessageSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const conversation = await getConversation(server, conversationId);
    if (!conversation) {
      return reply.status(404).send({ error: 'Not found' });
    }

    const user = request.user;
    if (!user?.tenantId) {
      return reply.status(403).send({ error: 'No tenant membership' });
    }

    if (conversation.tenant_id !== user.tenantId || conversation.user_id !== user.id) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const docResult = await server.db.query(
      `select d.id, d.title
       from chatbot_documents cd
       join documents d on d.id = cd.document_id
       where cd.chatbot_id = $1 and d.status = 'ready'
       order by d.created_at desc
       limit 1`,
      [conversation.chatbot_id]
    );

    const doc = docResult.rows[0];
    const citations = doc
      ? [
          {
            documentId: doc.id,
            documentTitle: doc.title,
            snippet: 'Reference from uploaded document.'
          }
        ]
      : [];

    const assistantContent = citations.length > 0
      ? 'This document appears to cover the uploaded content. [1]'
      : "I don't know.";

    const client = await server.db.connect();
    try {
      await client.query('begin');
      const userResult = await client.query(
        `insert into messages (conversation_id, sender, content, citations_json)
         values ($1, 'user', $2, '[]'::jsonb)
         returning id, conversation_id, sender, content, citations_json, created_at`,
        [conversationId, parsed.data.content]
      );

      const assistantResult = await client.query(
        `insert into messages (conversation_id, sender, content, citations_json)
         values ($1, 'assistant', $2, $3)
         returning id, conversation_id, sender, content, citations_json, created_at`,
        [conversationId, assistantContent, JSON.stringify(citations)]
      );

      await client.query('commit');

      return reply.status(201).send({
        userMessage: userResult.rows[0],
        assistantMessage: assistantResult.rows[0],
        citations
      });
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  });
}
