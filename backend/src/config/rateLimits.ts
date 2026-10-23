/**
 * Rate Limiting Configuration
 * ===========================
 * 
 * Tiered rate limiting for different endpoint types.
 * Protects against brute force attacks and API abuse.
 */

import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';

// disable rate limiting in test env so suites can hammer endpoints
const skipInTests = () => process.env.NODE_ENV === 'test';

/**
 * Rate limit configurations for different endpoint types
 */

/**
 * Authentication rate limiter
 * Strict limits for login/register to prevent brute force attacks
 */
export const authLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,                    // 5 attempts per window
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_AUTH',
      message: 'Too many login attempts, please try again after 15 minutes'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skip: skipInTests,
  keyGenerator: (req) => {
    // Use IP + email combination for more precise limiting
    const email = req.body?.email || '';
    return `${req.ip}-${email}`;
  }
});

/**
 * Password reset rate limiter
 * Very strict to prevent email enumeration and abuse
 */
export const passwordResetLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,                    // 3 password reset requests per hour
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_RESET',
      message: 'Too many password reset requests, please try again later'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests
});

/**
 * Sensitive operations rate limiter
 * For operations like email verification, 2FA setup, etc.
 */
export const sensitiveLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,                   // 10 sensitive operations per hour
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_SENSITIVE',
      message: 'Too many requests for this operation, please try again later'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests
});

/**
 * General API rate limiter
 * Standard rate limit for authenticated API requests
 */
export const apiLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000,      // 1 minute
  max: 100,                  // 100 requests per minute
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_API',
      message: 'Too many requests, please slow down'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => skipInTests() || ((req as any).user?.role === 'admin' || (req as any).user?.role === 'super_admin')
});

/**
 * Strict API rate limiter
 * For resource-intensive operations like search, exports, etc.
 */
export const strictApiLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000,      // 1 minute
  max: 30,                   // 30 requests per minute
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_STRICT',
      message: 'Too many requests for this resource, please wait'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests
});

/**
 * Public API rate limiter
 * For unauthenticated public endpoints
 */
export const publicLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000,      // 1 minute
  max: 60,                   // 60 requests per minute
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_PUBLIC',
      message: 'Too many requests, please try again shortly'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests
});

/**
 * Upload rate limiter
 * For file upload endpoints
 */
export const uploadLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50,                   // 50 uploads per hour
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_UPLOAD',
      message: 'Upload limit reached, please try again later'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests
});

/**
 * Collection of all rate limiters for easy import
 */
export const rateLimits = {
  auth: authLimiter,
  passwordReset: passwordResetLimiter,
  sensitive: sensitiveLimiter,
  api: apiLimiter,
  strictApi: strictApiLimiter,
  public: publicLimiter,
  upload: uploadLimiter
};

export default rateLimits;
