import express from 'express';
import dotenv from 'dotenv';
// enables async error forwarding to errorHandler for Express 4
import 'express-async-errors';
import cron from 'node-cron';

// Configuration imports
import {
  securityMiddleware,
  rateLimiter,
  corsConfig,
  bodyParserMiddleware,
  staticFilesConfig
} from './config/middleware';
import { reqIdMiddleware } from './middleware/reqId';
import { requestLogger } from './middleware/requestLogger';
import { responseTimeMiddleware } from './middleware/responseTime';
import { swaggerConfig } from './config/swagger';
import { registerRoutes } from './config/routes';
import { connectDatabase, setupGracefulShutdown } from './config/database';
import logger from './utils/logger';

// Queue infra (BullMQ + Redis) — fail-open if REDIS_URL is unset
import { getQueueConnection, closeQueueConnection } from './queue/connection';
import { startWorkers, closeWorkers } from './queue/workers';
import { getQueue, enqueue, QUEUE_NAMES, observeQueueEvents } from './queue/queues';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// If running behind a proxy (Render/Railway/Nginx), trust X-Forwarded-* headers
app.set('trust proxy', 1);

// ============================================
// Middleware Setup
// ============================================

// Request ID — must be first so every log + error can reference it
app.use(reqIdMiddleware);

// Response time header — X-Response-Time for monitoring
app.use(responseTimeMiddleware);

// Request logging — structured JSON logs with req-id correlation
app.use(requestLogger);

// Security & compression
app.use(...securityMiddleware);

// CORS configuration
app.use(corsConfig);

// Rate limiting (on API routes)
app.use('/api/', rateLimiter);

// API version header — lets clients know which version they're using
app.use('/api/', (_req, res, next) => {
  res.setHeader('X-API-Version', '1.0.0');
  next();
});

// Body parsing
app.use(...bodyParserMiddleware);

// ============================================
// API Setup
// ============================================

// Initialize Swagger
const swaggerSpec = swaggerConfig(PORT);

// Register all routes and documentation
registerRoutes(app, swaggerSpec);

// ============================================
// Server Startup
// ============================================

const startServer = async () => {
  try {
    // Connect to database
    if (process.env.NODE_ENV !== 'test') {
      await connectDatabase();
      setupGracefulShutdown();
    }

    // Start BullMQ workers (fail-open — no-op if REDIS_URL is unset)
    if (process.env.NODE_ENV !== 'test') {
      startWorkers();
      observeQueueEvents();

      // Schedule reservation cleanup as a repeating BullMQ job (every 60s).
      // Falls back to node-cron if the queue is unavailable so local dev
      // without Redis still cleans up expired reservations.
      const queue = getQueue(QUEUE_NAMES.RESERVATION_CLEANUP);
      if (queue) {
        // Remove any existing repeat job first to avoid duplicates across restarts.
        const existing = await queue.getRepeatableJobs();
        for (const job of existing) {
          await queue.removeRepeatableByKey(job.key);
        }
        await queue.add(
          'cleanup',
          {},
          { repeat: { every: 60_000 }, jobId: undefined, removeOnComplete: 50, removeOnFail: 100 },
        );
        logger.info({ msg: 'Reservation cleanup scheduled on BullMQ (every 60s)' });
      } else {
        // Fail-open: keep the node-cron fallback for local dev without Redis.
        cron.schedule('*/60 * * * * *', async () => {
          try {
            const { default: reservationService } = await import('./services/reservationService');
            const released = await reservationService.releaseExpired();
            if (released > 0) {
              logger.info({ msg: 'Released expired reservations (cron fallback)', count: released });
            }
          } catch (err) {
            logger.error({ msg: 'Reservation cleanup failed', error: (err as Error).message });
          }
        });
      }
    }

    // Start listening
    app.listen(PORT, () => {
      console.log(`\n🚀 Server running in ${process.env.NODE_ENV || 'development'} mode`);
      console.log(`📡 Port: ${PORT}`);
      console.log(`📖 API Docs: http://localhost:${PORT}/api-docs`);
      console.log(`🏥 Health Check: http://localhost:${PORT}/health\n`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  // catch stray promise rejections so they don't silently crash the process
  process.on('unhandledRejection', (reason) => {
    logger.error({ msg: 'Unhandled promise rejection', reason });
  });

  process.on('uncaughtException', (error) => {
    logger.error({ msg: 'Uncaught exception', error: error.message, stack: error.stack });
    // give logger time to flush then exit — process state is now unreliable
    setTimeout(() => process.exit(1), 1000);
  });

  // Graceful shutdown — close BullMQ workers + Redis connection so the
  // process exits cleanly.
  process.on('SIGTERM', async () => {
    logger.info({ msg: 'SIGTERM received — shutting down workers' });
    await closeWorkers();
    await closeQueueConnection();
    process.exit(0);
  });
  process.on('SIGINT', async () => {
    logger.info({ msg: 'SIGINT received — shutting down workers' });
    await closeWorkers();
    await closeQueueConnection();
    process.exit(0);
  });

  startServer();
}

export default app;