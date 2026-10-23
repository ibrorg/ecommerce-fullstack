import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import express from 'express';
import cookieParser from 'cookie-parser';

// helmet with production-grade defaults
// HSTS preload, strict CSP, no-sniff, frameguard deny
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://js.stripe.com'],
      frameSrc: ['https://js.stripe.com', 'https://hooks.stripe.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://api.stripe.com'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'", 'https://checkout.stripe.com']
    }
  },
  crossOriginEmbedderPolicy: false,
  // restrict browser features — e-commerce doesn't need camera, mic, etc.
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  frameguard: { action: 'deny' },
});

// Permissions-Policy: deny sensitive browser APIs (Helmet 7 removed the
// built-in option, so we set it manually). Payment is allowed for Stripe.
const permissionsPolicyValue = 'camera=(), microphone=(), geolocation=(), payment=(*), usb=(), bluetooth=(), nfc=()';

/**
 * Security middleware configuration
 */
export const securityMiddleware = [
  helmetConfig,
  compression(),
  // Permissions-Policy header (Helmet 7 doesn't support it natively)
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.setHeader('Permissions-Policy', permissionsPolicyValue);
    // Referrer-Policy: only send origin (not full URL) to other origins
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // X-DNS-Prefetch-Control: enable DNS prefetching for performance
    res.setHeader('X-DNS-Prefetch-Control', 'on');
    next();
  },
];

/**
 * Rate limiting configuration
 */
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 150, // max 150 requests per window
  message: 'Too many requests, please try again later.',
  // don't throttle the test suite
  skip: () => process.env.NODE_ENV === 'test'
});

/**
 * CORS configuration
 */
export const corsConfig = cors({
  origin: (origin, callback) => {
    const normalizeOrigin = (value: string) => value.trim().replace(/\/+$/, '');

    const envOrigins = (process.env.CORS_ORIGINS || '')
      .split(',')
      .map((v) => normalizeOrigin(v))
      .filter(Boolean);

    const allowedOrigins = Array.from(
      new Set([
        process.env.CLIENT_URL ? normalizeOrigin(process.env.CLIENT_URL) : 'http://localhost:5173',
        process.env.FRONTEND_URL ? normalizeOrigin(process.env.FRONTEND_URL) : undefined,
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5175',
        ...envOrigins,
      ].filter(Boolean) as string[])
    );

    // Allow requests with no origin (curl, mobile apps)
    if (!origin) return callback(null, true);

    const normalizedOrigin = normalizeOrigin(origin);

    if (allowedOrigins.includes(normalizedOrigin)) return callback(null, true);

    console.warn(`CORS blocked: ${origin}`);
    return callback(new Error('Not allowed by CORS policy'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'X-Request-Id', 'Idempotency-Key'],
  exposedHeaders: ['X-Request-Id', 'X-Response-Time', 'X-API-Version'],
  // cache preflight for 24 hours — avoids re-sending OPTIONS on every request
  maxAge: 86400,
  optionsSuccessStatus: 204
});

/**
 * Body parsing configuration
 */
export const bodyParserMiddleware = [
  express.json({ limit: '10mb' }),
  express.urlencoded({ extended: true, limit: '10mb' }),
  cookieParser(),
];

/**
 * Static files configuration
 */
export const staticFilesConfig = {
  path: '/uploads',
  directory: 'uploads'
};
