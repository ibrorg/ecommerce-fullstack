import IORedis from 'ioredis';
import logger from '../utils/logger';

/**
 * Redis connection for BullMQ.
 *
 * BullMQ requires an `ioredis` instance (not a plain redis client) because it
 * uses connection events and the `maxRetriesPerRequest` setting must be null
 * (BullMQ manages retries itself via the queue options).
 *
 * The connection is lazy: if REDIS_URL is unset, `getQueueConnection` returns
 * null and the queue layer becomes a no-op (jobs are executed inline). This
 * keeps local dev working without Redis — the same fail-open pattern used for
 * the optional Redis cache.
 */

let connection: IORedis | null = null;
let initAttempted = false;

export function getQueueConnection(): IORedis | null {
  if (initAttempted) return connection;
  initAttempted = true;

  const url = process.env.REDIS_URL;
  if (!url) {
    logger.warn({ msg: 'REDIS_URL not set — BullMQ queue is disabled (fail-open mode)' });
    return null;
  }

  try {
    connection = new IORedis(url, {
      maxRetriesPerRequest: null, // required by BullMQ
      enableReadyCheck: true,
      lazyConnect: false,
      reconnectOnError(err) {
        // Reconnect on READONLY errors (happens during Redis failover)
        return err.message.includes('READONLY');
      },
    });

    connection.on('error', (err) => {
      logger.error({ msg: 'Redis connection error', error: err.message });
    });

    connection.on('connect', () => {
      logger.info({ msg: 'Redis connected for BullMQ' });
    });

    return connection;
  } catch (err) {
    logger.error({ msg: 'Failed to create Redis connection', error: (err as Error).message });
    return null;
  }
}

export function isQueueEnabled(): boolean {
  return getQueueConnection() !== null;
}

/**
 * Graceful shutdown — disconnect Redis so the process can exit cleanly.
 */
export async function closeQueueConnection(): Promise<void> {
  if (connection) {
    await connection.quit();
    connection = null;
  }
}
