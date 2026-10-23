import { Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import express from 'express';
import mongoose from 'mongoose';

// Routes
import authRoutes from '../routes/auth';
import userRoutes from '../routes/users';
import productRoutes from '../routes/products';
import orderRoutes from '../routes/orders';
import uploadRoutes from '../routes/upload';
import adminRoutes from '../routes/admin';
import sellerRoutes from '../routes/seller';
import configRoutes from '../routes/config';
import approvalRoutes from '../routes/approvalRoutes';
import auditRoutes from '../routes/auditRoutes';
import couponRoutes from '../routes/coupons';
import returnRoutes from '../routes/returns';
import reservationRoutes from '../routes/reservations';
import razorpayRoutes from '../routes/razorpay';
import pincodeRoutes from '../routes/pincode';
import cartRoutes from '../routes/cart';
import notificationRoutes from '../routes/notifications';
import wishlistRoutes from '../routes/wishlist';
import searchRoutes from '../routes/search';
import addressRoutes from '../routes/addresses';

// Middleware
import { errorHandler, notFound } from '../middleware/errorHandler';

/**
 * Route configuration
 */
interface RouteConfig {
  path: string;
  router: any;
}

const routes: RouteConfig[] = [
  { path: '/api/auth', router: authRoutes },
  { path: '/api/users', router: userRoutes },
  { path: '/api/products', router: productRoutes },
  { path: '/api/orders', router: orderRoutes },
  { path: '/api/upload', router: uploadRoutes },
  { path: '/api/config', router: configRoutes },
  { path: '/api/admin', router: adminRoutes },
  { path: '/api/seller', router: sellerRoutes },
  { path: '/api/admin/approvals', router: approvalRoutes },
  { path: '/api/audit', router: auditRoutes },
  { path: '/api/coupons', router: couponRoutes },
  { path: '/api/returns', router: returnRoutes },
  { path: '/api/reservations', router: reservationRoutes },
  { path: '/api/razorpay', router: razorpayRoutes },
  { path: '/api/pincode', router: pincodeRoutes },
  { path: '/api/cart', router: cartRoutes },
  { path: '/api/notifications', router: notificationRoutes },
  { path: '/api/wishlist', router: wishlistRoutes },
  { path: '/api/search', router: searchRoutes },
  { path: '/api/addresses', router: addressRoutes }
];

/**
 * Register all routes and API documentation
 */
export const registerRoutes = (app: Express, swaggerSpec: any) => {
  // API Documentation
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // Health check (liveness — process is up)
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      memory: {
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
    });
  });

  // Readiness check — DB must be reachable before taking traffic
  app.get('/ready', async (req, res) => {
    try {
      const db = mongoose.connection.db;
      if (!db) {
        res.status(503).json({
          status: 'not_ready',
          reason: 'database_not_connected',
          timestamp: new Date().toISOString(),
        });
        return;
      }
      await db.admin().ping();
      res.status(200).json({
        status: 'ready',
        database: 'connected',
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      res.status(503).json({
        status: 'not_ready',
        reason: 'database_ping_failed',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Register all routes under both /api/ (backward compat) and /api/v1/ (versioned)
  routes.forEach(({ path, router }) => {
    app.use(path, router); // backward-compat: /api/products
    const versionedPath = path.replace('/api/', '/api/v1/');
    app.use(versionedPath, router); // versioned: /api/v1/products
  });

  // Static files for uploads
  app.use('/uploads', express.static('uploads'));

  // Error handling (must be last)
  app.use(notFound);
  app.use(errorHandler);
};
