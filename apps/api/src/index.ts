import { env } from '@docuchat/config';
import { createLogger } from '@docuchat/logger';
import { createQueue } from '@docuchat/queue';
import { buildServer } from './app';

const logger = createLogger(env.apiLogLevel);
const server = buildServer();
const queue = createQueue(env.queueName, env.redisUrl);

const start = async () => {
  try {
    await server.db.query('select 1');
    logger.info('Database connection ready');
  } catch (err) {
    logger.error('Database connection failed', err);
    process.exit(1);
  }

  try {
    await queue.waitUntilReady();
    logger.info('Queue connection ready');
  } catch (err) {
    logger.error('Queue connection failed', err);
    process.exit(1);
  }

  try {
    await server.listen({ port: env.port, host: '0.0.0.0' });
    logger.info(`API listening on port ${env.port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

void start();
