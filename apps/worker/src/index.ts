import { env } from '@docuchat/config';
import { createLogger } from '@docuchat/logger';
import { createWorker } from '@docuchat/queue';

const logger = createLogger(env.workerLogLevel);

const worker = createWorker(env.queueName, env.redisUrl, async (job) => {
  logger.info(`Processing job ${job.id}`);
  return { id: job.id, status: 'processed' };
});

worker.on('completed', (job) => {
  logger.info(`Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  logger.error(`Job ${job?.id} failed`, err);
});

logger.info(`Worker started for queue ${env.queueName}`);

setInterval(() => {
  logger.info('Worker heartbeat');
}, env.workerHeartbeatMs);
