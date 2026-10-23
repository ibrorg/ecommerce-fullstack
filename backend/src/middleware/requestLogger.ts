import pinoHttp from 'pino-http';
import logger from '../utils/logger';

/**
 * Request Logger Middleware
 * =========================
 *
 * Logs every HTTP request with the req-id (from reqId middleware), method,
 * path, status code, and response time. Uses pino-http for structured JSON
 * logging that can be shipped to an aggregator (Datadog, ELK, etc.).
 *
 * In test mode, logging is suppressed to keep test output clean.
 */
export const requestLogger = pinoHttp({
  logger,
  // custom request ID — use the one set by reqId middleware
  genReqId: (req) => (req as any).requestId || 'unknown',
  // log level by status code
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  // include method + url in the log message
  customSuccessMessage: (req, res) =>
    `${req.method} ${req.url} → ${res.statusCode} (${(res as any).responseTime}ms)`,
  customErrorMessage: (req, res, err) =>
    `${req.method} ${req.url} → ${res.statusCode} ${err.message}`,
  // don't log health checks (they'd flood the logs)
  autoLogging: {
    ignore: (req) => {
      const url = (req as any).url || '';
      return url === '/health' || url === '/ready';
    },
  },
  // skip in test mode
  enabled: process.env.NODE_ENV !== 'test',
});
