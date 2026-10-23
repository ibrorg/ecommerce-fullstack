import { Request, Response, NextFunction } from 'express';
import IdempotencyRecord from '../models/IdempotencyRecord';

/**
 * Idempotency Middleware
 * ======================
 *
 * When a client sends an `Idempotency-Key` header, the server caches the
 * response (status code + body) keyed by (key, userId). A subsequent request
 * with the same key + user returns the cached response instead of re-executing
 * the handler — preventing duplicate order creation from double-submits,
 * network retries, or client crashes.
 *
 * Behaviour:
 *   - No header → request proceeds normally (backward-compatible).
 *   - Header + cached response found → return cached status + body immediately.
 *   - Header + no cache → proceed, intercept res.json to capture the response,
 *     store it (only for 2xx responses — errors are not cached so the client
 *     can retry with the same key).
 *
 * The key is scoped per-user so different users can reuse the same key.
 * Records auto-expire after 24h via a TTL index on the model.
 *
 * Must be placed AFTER `protect` (needs req.user) and BEFORE the route handler.
 */
export async function idempotencyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const key = req.get('Idempotency-Key');

  if (!key) {
    next();
    return;
  }

  const userId = (req as any).user?._id;
  if (!userId) {
    // no authenticated user — can't scope, proceed without idempotency
    next();
    return;
  }

  try {
    // check for an existing cached response
    const existing = await IdempotencyRecord.findOne({ key, userId }).lean();
    if (existing) {
      res.status(existing.statusCode).json(existing.responseBody);
      return;
    }

    // intercept res.json to capture the response body for caching
    const originalJson = res.json.bind(res);
    (res as any).json = (body: unknown) => {
      // only cache successful responses — errors should be retryable
      if (res.statusCode >= 200 && res.statusCode < 300) {
        IdempotencyRecord.create({
          key,
          userId,
          statusCode: res.statusCode,
          responseBody: body,
        }).catch(() => {
          // duplicate key from concurrent requests with the same key —
          // the first request wins, this one is a no-op
        });
      }
      return originalJson(body as any);
    };

    next();
  } catch {
    // on any DB error, proceed without idempotency (fail-open)
    next();
  }
}
