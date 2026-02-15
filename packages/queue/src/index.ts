import { Queue, Worker } from 'bullmq';
import type { ConnectionOptions, Processor } from 'bullmq';

export const createRedisConnection = (redisUrl: string): ConnectionOptions => {
  const url = new URL(redisUrl);
  const db = url.pathname ? Number(url.pathname.slice(1)) : undefined;
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    username: url.username || undefined,
    password: url.password || undefined,
    db: Number.isNaN(db) ? undefined : db,
  };
};

export const createQueue = (name: string, redisUrl: string) => {
  const connection = createRedisConnection(redisUrl);
  return new Queue(name, { connection });
};

export const createWorker = <T = unknown, R = unknown, N extends string = string>(
  name: string,
  redisUrl: string,
  processor: Processor<T, R, N>,
) => {
  const connection = createRedisConnection(redisUrl);
  return new Worker<T, R, N>(name, processor, { connection });
};
