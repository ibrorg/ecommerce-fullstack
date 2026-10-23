import { Request, Response, NextFunction } from 'express';
import onHeaders from 'on-headers';

/**
 * Response Time Middleware
 * =======================
 *
 * Measures request processing time and sets it as the X-Response-Time
 * response header (in milliseconds). Uses on-headers (Express's built-in
 * dependency) to intercept headers just before they're flushed — works
 * correctly with all response methods (json, send, end).
 *
 * Must be placed early in the middleware stack (after reqId, before routes).
 */
export function responseTimeMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();

  onHeaders(res, () => {
    const elapsedNs = process.hrtime.bigint() - start;
    const elapsedMs = Number(elapsedNs) / 1_000_000;
    res.setHeader('X-Response-Time', `${elapsedMs.toFixed(2)}ms`);
  });

  next();
}

