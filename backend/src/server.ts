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

  // release expired inventory reservations every 60 seconds
  // TTL index is the safety net; this is the primary cleanup + restock
  cron.schedule('*/60 * * * * *', async () => {
    try {
      const { default: reservationService } = await import('./services/reservationService');
      const released = await reservationService.releaseExpired();
      if (released > 0) {
        logger.info({ msg: 'Released expired reservations', count: released });
      }
    } catch (err) {
      logger.error({ msg: 'Reservation cleanup failed', error: (err as Error).message });
    }
  });

  startServer();
}

export default app;