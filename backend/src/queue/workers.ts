import { Worker, Job } from 'bullmq';
import { getQueueConnection, isQueueEnabled } from './connection';
import { QUEUE_NAMES, QueueName } from './queues';
import { runReservationCleanup } from './jobs/reservationCleanup';
import { runEmailSend } from './jobs/emailSend';
import { runSearchIndex } from './jobs/searchIndex';
import { runEmbeddingGeneration } from './jobs/embeddingGeneration';
import logger from '../utils/logger';

/**
 * Job handler registry — maps queue name → processor function.
 * Each processor receives the job's `data` and does the work. Throwing here
 * triggers BullMQ's retry/backoff (see enqueue() options).
 */
type JobProcessor = (data: any) => Promise<void>;

const handlers: Record<QueueName, JobProcessor> = {
  [QUEUE_NAMES.RESERVATION_CLEANUP]: runReservationCleanup,
  [QUEUE_NAMES.EMAIL]: runEmailSend,
  [QUEUE_NAMES.SEARCH_INDEX]: runSearchIndex,
  [QUEUE_NAMES.EMBEDDING]: runEmbeddingGeneration,
};

const workers: Worker[] = [];

/**
 * Start all BullMQ workers. Called once on server startup.
 * If Redis is unavailable, this is a no-op (jobs run inline via enqueue's
 * fail-open path).
 */
export function startWorkers(): void {
  const connection = getQueueConnection();
  if (!connection) {
    logger.info({ msg: 'BullMQ workers not started (no Redis connection)' });
    return;
  }

  for (const name of Object.values(QUEUE_NAMES) as QueueName[]) {
    const processor = handlers[name];
    const worker = new Worker(
      name,
      async (job: Job) => {
        logger.info({ msg: 'Processing job', queue: name, jobId: job.id });
        await processor(job.data);
      },
      {
        connection,
        concurrency: 5,
      },
    );

    worker.on('error', (err) => {
      logger.error({ msg: 'Worker error', queue: name, error: err.message });
    });

    workers.push(worker);
    logger.info({ msg: 'BullMQ worker started', queue: name });
  }
}

/**
 * Graceful shutdown — close all workers so in-flight jobs finish.
 */
export async function closeWorkers(): Promise<void> {
  await Promise.all(workers.map((w) => w.close()));
  workers.length = 0;
}

export { isQueueEnabled };
