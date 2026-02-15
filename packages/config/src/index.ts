import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

const loadedEnvMarker = Symbol.for('docuchat.env.loaded');

const loadEnv = () => {
  const globalSymbols = globalThis as typeof globalThis & {
    [loadedEnvMarker]?: boolean;
  };
  if (globalSymbols[loadedEnvMarker]) {
    return;
  }

  const overridePath = process.env.DOCUCHAT_ENV_FILE;
  if (overridePath) {
    dotenv.config({ path: overridePath });
    globalSymbols[loadedEnvMarker] = true;
    return;
  }

  const envFileNames = ['.env', '.env.local'];
  const searchDirs: string[] = [];
  let currentDir = process.cwd();
  while (true) {
    searchDirs.push(currentDir);
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  for (const dir of searchDirs) {
    const envPaths = envFileNames
      .map((filename) => path.join(dir, filename))
      .filter((filePath) => fs.existsSync(filePath));
    if (envPaths.length > 0) {
      for (const envPath of envPaths) {
        dotenv.config({ path: envPath });
      }
      break;
    }
  }

  globalSymbols[loadedEnvMarker] = true;
};

loadEnv();

const getString = (name: string, fallback?: string) => {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value.trim() === '') {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
};

const logLevels = ['debug', 'info', 'warn', 'error'] as const;
export type LogLevel = (typeof logLevels)[number];

const getLogLevel = (name: string, fallback: LogLevel): LogLevel => {
  const value = getString(name, fallback);
  if (!logLevels.includes(value as LogLevel)) {
    throw new Error(`Invalid log level for env: ${name}`);
  }
  return value as LogLevel;
};

const getNumber = (name: string, fallback?: number) => {
  const raw = process.env[name] ?? (fallback !== undefined ? String(fallback) : undefined);
  if (raw === undefined || raw.trim() === '') {
    throw new Error(`Missing required env: ${name}`);
  }
  const value = Number(raw);
  if (Number.isNaN(value)) {
    throw new Error(`Invalid number for env: ${name}`);
  }
  return value;
};

const getOptionalString = (name: string, fallback?: string) => {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value.trim() === '') {
    return undefined;
  }
  return value;
};

export const env: {
  nodeEnv: string;
  port: number;
  apiLogLevel: LogLevel;
  workerLogLevel: LogLevel;
  databaseUrl: string;
  redisUrl: string;
  queueName: string;
  workerHeartbeatMs: number;
  s3: {
    endpoint: string;
    region: string;
    bucket: string;
    accessKey: string;
    secretKey: string;
  };
  auth: {
    accessTokenSecret: string;
    refreshTokenSecret: string;
    accessTokenTtlSeconds: number;
    refreshTokenTtlSeconds: number;
    issuer: string;
    audience: string;
    accessCookieName: string;
    refreshCookieName: string;
    csrfCookieName: string;
    cookieDomain?: string;
    secureCookies: boolean;
    appBaseUrl: string;
    passwordMinLength: number;
  };
} = {
  nodeEnv: getString('NODE_ENV', 'development'),
  port: getNumber('PORT', 3000),
  apiLogLevel: getLogLevel('API_LOG_LEVEL', 'info'),
  workerLogLevel: getLogLevel('WORKER_LOG_LEVEL', 'info'),
  databaseUrl: getString(
    'DATABASE_URL',
    'postgres://docuchat:docuchat@localhost:5432/docuchat',
  ),
  redisUrl: getString('REDIS_URL', 'redis://localhost:6379'),
  queueName: getString('QUEUE_NAME', 'docuchat-jobs'),
  workerHeartbeatMs: getNumber('WORKER_HEARTBEAT_MS', 10000),
  s3: {
    endpoint: getString('S3_ENDPOINT', 'http://localhost:9000'),
    region: getString('S3_REGION', 'us-east-1'),
    bucket: getString('S3_BUCKET', 'docuchat'),
    accessKey: getString('S3_ACCESS_KEY', 'minioadmin'),
    secretKey: getString('S3_SECRET_KEY', 'minioadmin')
  },
  auth: {
    accessTokenSecret: getString('AUTH_ACCESS_TOKEN_SECRET'),
    refreshTokenSecret: getString('AUTH_REFRESH_TOKEN_SECRET'),
    accessTokenTtlSeconds: getNumber('AUTH_ACCESS_TOKEN_TTL_SECONDS', 900),
    refreshTokenTtlSeconds: getNumber('AUTH_REFRESH_TOKEN_TTL_SECONDS', 2592000),
    issuer: getString('AUTH_JWT_ISSUER', 'docuchat'),
    audience: getString('AUTH_JWT_AUDIENCE', 'docuchat-api'),
    accessCookieName: getString('AUTH_ACCESS_COOKIE_NAME', 'docuchat_access'),
    refreshCookieName: getString('AUTH_REFRESH_COOKIE_NAME', 'docuchat_refresh'),
    csrfCookieName: getString('AUTH_CSRF_COOKIE_NAME', 'docuchat_csrf'),
    cookieDomain: getOptionalString('AUTH_COOKIE_DOMAIN'),
    secureCookies: getString('AUTH_SECURE_COOKIES', 'true') === 'true',
    appBaseUrl: getString('APP_BASE_URL', 'http://localhost:3000'),
    passwordMinLength: getNumber('AUTH_PASSWORD_MIN_LENGTH', 12)
  }
};
