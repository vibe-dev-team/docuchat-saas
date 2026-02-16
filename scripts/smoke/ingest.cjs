#!/usr/bin/env node
require('./env.cjs');

const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const { env } = require('@docuchat/config');
const { createPool } = require('@docuchat/db');

const port = Number(process.env.SMOKE_PORT ?? 4010);
const apiPath = 'apps/api/dist/index.js';
const workerPath = 'apps/worker/dist/index.js';
const baseUrl = process.env.SMOKE_API_BASE_URL ?? `http://localhost:${port}`;

const email = process.env.SMOKE_EMAIL;
const password = process.env.SMOKE_PASSWORD;
const pdfPath = process.env.SMOKE_PDF_PATH ?? path.join(__dirname, 'assets', 'sample.pdf');
const csrfCookieName = process.env.AUTH_CSRF_COOKIE_NAME ?? 'docuchat_csrf';
const accessCookieName = process.env.AUTH_ACCESS_COOKIE_NAME ?? 'docuchat_access';

if (!email || !password) {
  console.error(
    'Missing SMOKE_EMAIL or SMOKE_PASSWORD.\n' +
      'Set them for a seeded user (e.g. `ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=StrongPass123 npm run db:seed:admin`).\n' +
      'Then export SMOKE_EMAIL/SMOKE_PASSWORD or add them to your .env file.'
  );
  process.exit(1);
}

if (!fs.existsSync(pdfPath)) {
  console.error(`Sample PDF not found at ${pdfPath}`);
  process.exit(1);
}

const waitForPort = async (host, port, timeoutMs = 20000) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      await new Promise((resolve, reject) => {
        const socket = net.createConnection({ host, port }, () => {
          socket.end();
          resolve();
        });
        socket.on('error', reject);
      });
      return;
    } catch (err) {
      await delay(500);
    }
  }
  throw new Error(`Timed out waiting for ${host}:${port}`);
};

const waitForHealth = async (timeoutMs = 20000) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${baseUrl}/health`);
      if (res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body.status === 'ok') {
          return;
        }
      }
    } catch (err) {
      // ignore until timeout
    }
    await delay(500);
  }
  throw new Error('API /health did not respond in time');
};

const spawnProcess = (label, command, args, envOverrides) => {
  const child = spawn(command, args, {
    env: { ...process.env, ...envOverrides },
    stdio: 'inherit',
  });
  child.on('exit', (code) => {
    if (code !== 0) {
      console.error(`${label} exited with code ${code}`);
    }
  });
  return child;
};

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

const uploadPdf = async (tenantId, jar) => {
  const buffer = fs.readFileSync(pdfPath);
  const form = new FormData();
  form.append('title', 'Smoke Test Document');
  form.append('file', new Blob([buffer], { type: 'application/pdf' }), path.basename(pdfPath));

  const headers = {};
  if (jar && jar.size > 0) {
    headers.cookie = cookieHeader(jar);
    const csrfToken = jar.get(csrfCookieName);
    if (csrfToken) {
      headers['x-csrf-token'] = csrfToken;
    }
  }

  const res = await fetch(`${baseUrl}/documents/tenants/${tenantId}/upload`, {
    method: 'POST',
    headers,
    body: form
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Upload failed: ${res.status} ${JSON.stringify(json)}`);
  }

  return json;
};

const waitForDocumentReady = async (pool, documentId, timeoutMs = 120000) => {
  const started = Date.now();
  let lastStatus = null;
  while (Date.now() - started < timeoutMs) {
    const result = await pool.query('select status from documents where id = $1', [documentId]);
    const status = result.rows[0]?.status;
    if (status && status !== lastStatus) {
      console.log(`Document status: ${status}`);
      lastStatus = status;
    }
    if (status === 'ready') {
      return;
    }
    if (status === 'failed') {
      throw new Error('Document processing failed');
    }
    await delay(1500);
  }
  throw new Error('Timed out waiting for document to become ready');
};

const main = async () => {
  console.log('Waiting for Postgres and Redis...');
  await waitForPort('127.0.0.1', 5432);
  await waitForPort('127.0.0.1', 6379);

  const s3Url = new URL(env.s3.endpoint);
  const s3Port = s3Url.port ? Number(s3Url.port) : s3Url.protocol === 'https:' ? 443 : 80;
  console.log('Waiting for MinIO...');
  await waitForPort(s3Url.hostname, s3Port);

  console.log('Starting worker...');
  const worker = spawnProcess('worker', 'node', [workerPath], {
    NODE_ENV: 'test',
    WORKER_LOG_LEVEL: 'warn'
  });

  console.log('Starting API...');
  const api = spawnProcess('api', 'node', [apiPath], {
    NODE_ENV: 'test',
    API_LOG_LEVEL: 'warn',
    PORT: String(port)
  });

  const pool = createPool(env.databaseUrl);

  try {
    await waitForHealth();

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

    const me = await requestJson('GET', '/auth/me', cookies);
    const tenantId = me.user?.tenantId;
    if (!tenantId) {
      throw new Error('Failed to resolve tenant ID');
    }

    console.log('Uploading PDF...');
    const upload = await uploadPdf(tenantId, cookies);
    const documentId = upload.documentId;
    if (!documentId) {
      throw new Error('Upload response missing documentId');
    }

    console.log(`Uploaded document ${documentId}, waiting for ready status...`);
    await waitForDocumentReady(pool, documentId);

    if (worker.killed || worker.exitCode !== null) {
      throw new Error('Worker exited during smoke test');
    }

    console.log('Smoke test passed: document ingested and ready.');
  } finally {
    await pool.end().catch(() => undefined);
    api.kill('SIGTERM');
    worker.kill('SIGTERM');
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
