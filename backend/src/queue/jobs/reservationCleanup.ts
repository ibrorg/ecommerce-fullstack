import reservationService from '../../services/reservationService';
import logger from '../../utils/logger';

/**
 * Reservation cleanup job.
 *
 * Releases expired inventory reservations (TTL safety net + primary cleanup).
 * Previously a node-cron task running every 60s; now a BullMQ repeating job
 * so the work is decoupled from the request path and survives transient
 * failures via retries.
 */
export async function runReservationCleanup(_data: unknown): Promise<void> {
  const released = await reservationService.releaseExpired();
  if (released > 0) {
    logger.info({ msg: '[job] Released expired reservations', count: released });
  }
}
