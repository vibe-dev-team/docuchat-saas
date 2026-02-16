#!/usr/bin/env node
require('./env.cjs');

const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const net = require('node:net');
const path = require('node:path');

const port = Number(process.env.SMOKE_PORT ?? 4010);
const apiPath = 'apps/api/dist/index.js';
const workerPath = 'apps/worker/dist/index.js';
const chatbotsPath = path.join(__dirname, 'chatbots.cjs');

const waitForPort = async (host, port, timeoutMs = 15000) => {
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
      const res = await fetch(`http://localhost:${port}/health`);
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

const waitForExit = (child) =>
  new Promise((resolve, reject) => {
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Chatbot smoke exited with code ${code}`));
      }
    });
    child.on('error', reject);
  });

const main = async () => {
  console.log('Waiting for Postgres and Redis...');
  await waitForPort('127.0.0.1', 5432);
  await waitForPort('127.0.0.1', 6379);

  console.log('Starting worker...');
  const worker = spawnProcess('worker', 'node', [workerPath], {
    NODE_ENV: 'test',
    WORKER_LOG_LEVEL: 'warn',
  });

  console.log('Starting API...');
  const api = spawnProcess('api', 'node', [apiPath], {
    NODE_ENV: 'test',
    API_LOG_LEVEL: 'warn',
    PORT: String(port),
  });

  try {
    await waitForHealth();
    const chatbots = spawnProcess('chatbots', 'node', [chatbotsPath]);
    await waitForExit(chatbots);
  } finally {
    api.kill('SIGTERM');
    worker.kill('SIGTERM');
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
