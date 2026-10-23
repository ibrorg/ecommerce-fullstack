import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

/**
 * Request ID Middleware
 * ====================
 *
 * Generates (or accepts) a unique ID per request for log correlation and
 * distributed tracing. The ID is:
 *   1. Read from the incoming X-Request-Id header (if a gateway set one)
 *   2. Otherwise generated via crypto.randomUUID()
 *   3. Attached to req.requestId (declared in the Express namespace in auth.ts)
 *   4. Echoed back as X-Request-Id response header so clients can reference it
 *
 * This lets pino logs, error responses, and support tickets all reference
 * the same ID, cutting MTTR.
 */
export function reqIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.get('X-Request-Id');
  // sanitize: only allow UUID-like strings from the incoming header to prevent
  // log injection via crafted header values
  const id = incoming && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(incoming)
    ? incoming
    : randomUUID();

  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}
