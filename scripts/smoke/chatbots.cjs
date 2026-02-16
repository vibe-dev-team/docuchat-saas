#!/usr/bin/env node
require('./env.cjs');

const baseUrl = process.env.SMOKE_API_BASE_URL ?? 'http://localhost:4010';
const email = process.env.SMOKE_EMAIL;
const password = process.env.SMOKE_PASSWORD;
const documentId = process.env.SMOKE_DOCUMENT_ID;
const csrfCookieName = process.env.AUTH_CSRF_COOKIE_NAME ?? 'docuchat_csrf';
const accessCookieName = process.env.AUTH_ACCESS_COOKIE_NAME ?? 'docuchat_access';
const skipQa = process.env.SMOKE_SKIP_QA === 'true';

if (!email || !password) {
  console.error(
    'Missing SMOKE_EMAIL or SMOKE_PASSWORD.\n' +
      'Set them for a seeded user (e.g. `ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=StrongPass123 npm run db:seed:admin`).\n' +
      'Then export SMOKE_EMAIL/SMOKE_PASSWORD or add them to your .env file.'
  );
  process.exit(1);
}

if (!documentId && !skipQa) {
  console.error('Missing SMOKE_DOCUMENT_ID (set SMOKE_SKIP_QA=true to skip Q&A)');
  process.exit(1);
}

const parseCookies = (setCookies) => {
  const jar = new Map();
  for (const raw of setCookies) {
    const [pair] = raw.split(';');
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const name = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    jar.set(name, value);
  }
  return jar;
};

const getSetCookies = (headers) => {
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie();
  }
  if (typeof headers.raw === 'function') {
    return headers.raw()['set-cookie'] ?? [];
  }
  const single = headers.get('set-cookie');
  return single ? [single] : [];
};

const cookieHeader = (jar) =>
  Array.from(jar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');

const requestJson = async (method, path, jar, body) => {
  const headers = { 'content-type': 'application/json' };
  if (jar && jar.size > 0) {
    headers.cookie = cookieHeader(jar);
    if (method !== 'GET' && method !== 'HEAD') {
      const csrfToken = jar.get(csrfCookieName);
      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
      }
    }
  }

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${method} ${path} failed: ${res.status} ${JSON.stringify(json)}`);
  }
  return json;
};

const main = async () => {
  console.log('Logging in...');
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  if (!loginRes.ok) {
    const detail = await loginRes.text().catch(() => '');
    throw new Error(`Login failed: ${loginRes.status} ${detail}`);
  }

  const cookies = parseCookies(getSetCookies(loginRes.headers));
  if (!cookies.has(accessCookieName)) {
    throw new Error('Login did not return auth cookies');
  }

  console.log('Creating chatbot...');
  const chatbot = await requestJson('POST', '/chatbots', cookies, {
    name: 'Smoke Test Bot',
    systemPrompt: 'You are a helpful assistant.'
  });

  const chatbotId = chatbot.chatbot?.id;
  if (!chatbotId) {
    throw new Error('Chatbot creation failed');
  }

  console.log('Linking document...');
  await requestJson('POST', `/chatbots/${chatbotId}/documents`, cookies, {
    documentIds: [documentId]
  });

  console.log('Creating conversation...');
  const conversation = await requestJson('POST', `/chatbots/${chatbotId}/conversations`, cookies, {
    title: 'Smoke Conversation'
  });
  const conversationId = conversation.conversation?.id;
  if (!conversationId) {
    throw new Error('Conversation creation failed');
  }

  if (!skipQa) {
    console.log('Posting Q&A message...');
    const response = await requestJson(
      'POST',
      `/conversations/${conversationId}/messages`,
      cookies,
      { content: 'What is this document about?' }
    );
    if (!response.assistantMessage) {
      throw new Error('Assistant response missing');
    }

    const responseCitations = Array.isArray(response.citations) ? response.citations : [];
    if (responseCitations.length === 0) {
      throw new Error('Assistant response missing citations');
    }

    console.log(`Assistant returned ${responseCitations.length} citation(s).`);

    console.log('Fetching messages...');
    const messages = await requestJson(
      'GET',
      `/conversations/${conversationId}/messages`,
      cookies
    );
    if (!Array.isArray(messages.messages) || messages.messages.length < 2) {
      throw new Error('Message history missing user/assistant turns');
    }
  } else {
    console.log('Skipping Q&A step (SMOKE_SKIP_QA=true)');
  }

  console.log('Smoke test passed: chatbot CRUD + Q&A flow.');
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
