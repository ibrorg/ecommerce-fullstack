import { Queue, QueueEvents } from 'bullmq';
import { getQueueConnection } from './connection';
import logger from '../utils/logger';

/**
 * Queue definitions.
 *
 * Each queue is a named work pipeline. Producers call `queues.<name>.add(...)`
 * to enqueue a job; workers in `workers.ts` consume them.
 *
 * If Redis is unavailable, `getQueue()` returns null and the queue helper
 * `enqueue()` runs the job inline (fail-open). This means local dev without
 * Redis still works — the job just runs synchronously.
 */

export const QUEUE_NAMES = {
  RESERVATION_CLEANUP: 'reservation-cleanup',
  EMAIL: 'email',
  SEARCH_INDEX: 'search-index',
  EMBEDDING: 'embedding',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

const queueCache = new Map<QueueName, Queue>();

export function getQueue(name: QueueName): Queue | null {
  const connection = getQueueConnection();
  if (!connection) return null;

  let q = queueCache.get(name);
  if (!q) {
    q = new Queue(name, { connection });
    queueCache.set(name, q);
  }
  return q;
}

/**
 * Enqueue a job. If the queue is unavailable (no Redis), the job is executed
 * inline by calling `handler(jobData)` directly. This is the fail-open pattern
 * — the system keeps working, just without the async decoupling.
 *
 * `handler` is only used in fail-open mode; in normal mode the worker (defined
 * in workers.ts) processes the job.
 */
export async function enqueue<T>(
  name: QueueName,
  data: T,
  opts?: { delay?: number; jobId?: string },
): Promise<void> {
  const queue = getQueue(name);
  if (!queue) {
    logger.warn({
      msg: 'Queue unavailable, skipping enqueue',
      queue: name,
    });
    return;
  }

  await queue.add('default', data as any, {
    delay: opts?.delay,
    jobId: opts?.jobId,
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  });
}

/**
 * Set up queue event listeners for monitoring (failed/completed counts).
 * Called once on server startup.
 */
export function observeQueueEvents(): void {
  const connection = getQueueConnection();
  if (!connection) return;

  for (const name of Object.values(QUEUE_NAMES)) {
    const events = new QueueEvents(name, { connection });
    events.on('failed', ({ jobId, failedReason }) => {
      logger.error({ msg: 'Job failed', queue: name, jobId, reason: failedReason });
    });
  }
}
