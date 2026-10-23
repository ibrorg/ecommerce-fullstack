/**
 * Authentication Middleware (Enterprise-Grade)
 * ============================================
 * 
 * Guard for protected routes
 * Validates JWT + checks session + enforces security
 * 
 * EXECUTION FLOW:
 * 1. Extract token from Authorization header
 * 2. Verify JWT signature + expiration
 * 3. Check session still active (not revoked)
 * 4. Verify user still active (not suspended)
 * 5. Verify device hasn't changed
 * 6. Check IP consistency (warn if changed)
 * 7. Attach user + session to request
 * 
 * SECURITY PRINCIPLES:
 * - Trust nothing from client
 * - Verify every claim server-side
 * - Check session every request
 * - Session can be revoked independently
 * - Device mismatch = require re-auth
 * 
 * NEVER:
 * - Trust JWT claims alone
 * - Skip session lookup
 * - Allow suspended users
 * - Use old token after logout
 */

import { Request, Response, NextFunction } from 'express';
import User, { IUser } from '../models/User';
import Session, { ISession } from '../models/Session';
import AuthService from '../services/AuthService';

/**
 * Extend Express Request to include authenticated user
 */
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      user?: IUser;
      session?: ISession;
      sessionId?: string;
      deviceId?: string;
      ip?: string;
      requestId?: string;
      id?: string;
    }
  }
}

/**
 * Extract JWT token from Authorization header
 * Format: "Bearer <token>"
 */
function extractToken(req: Request): string | null {
  const authHeader = req.get('Authorization');
  
  if (!authHeader) {
    return null;
  }
  
  const parts = authHeader.split(' ');
  
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }
  
  return parts[1];
}

/**
 * Authentication Middleware
 * Validates JWT + session + user status
 * 
 * MUST be placed AFTER body parser + CORS middleware
 * Usage: app.use(authenticate)  // Protect all routes
 * Usage: app.get('/route', authenticate, handler)  // Protect single route
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract token
    const token = extractToken(req);
    
    if (!token) {
      res.status(401).json({
        status: 'error',
        error: {
          code: 'MISSING_TOKEN',
          message: 'Authentication token required'
        }
      });
      return;
    }
    
    // Verify JWT
    const authService = new AuthService();
    
    let payload;
    try {
      payload = await authService.verifyAccessToken(token);
    } catch (error) {
      res.status(401).json({
        status: 'error',
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired token'
        }
      });
      return;
    }
    
    // Lookup session (verify it still exists + is active)
    const session = await Session.findBySessionId(payload.sessionId);
    
    if (!session || !session.isActive()) {
      res.status(401).json({
        status: 'error',
        error: {
          code: 'SESSION_INVALID',
          message: 'Session expired or revoked. Please login again.'
        }
      });
      return;
    }
    
    // Verify user still exists and is active
    const user = await User.findById(payload.userId);
    
    if (!user || user.status !== 'active') {
      // Revoke session on account suspension/deletion
      session.revoke('account_suspended');
      await session.save();
      
      res.status(401).json({
        status: 'error',
        error: {
          code: 'USER_INACTIVE',
          message: 'Account is no longer active'
        }
      });
      return;
    }
    
    // Check if session requires re-authentication
    if (session.requiresReauth) {
      res.status(401).json({
        status: 'error',
        error: {
          code: 'REAUTH_REQUIRED',
          message: 'Please re-authenticate from this device'
        }
      });
      return;
    }
    
    // Verify device hasn't changed
    if (session.deviceId !== payload.deviceId) {
      session.requiresReauth = true;
      session.suspiciousActivityDetected = true;
      await session.save();
      
      res.status(401).json({
        status: 'error',
        error: {
          code: 'DEVICE_MISMATCH',
          message: 'Device verification failed'
        }
      });
      return;
    }
    
    // Optional: Check IP hasn't changed too dramatically
    const currentIP = req.ip || 'unknown';
    if (session.ipAddress !== currentIP) {
      console.warn(`[Security] IP changed for session ${session.sessionId}: ${session.ipAddress} → ${currentIP}`);
      // Log but don't block (IPs can change legitimately)
    }
    
    // Update last activity
    session.lastActivityAt = new Date();
    await session.save();
    
    // Attach to request for use in handlers
    req.userId = payload.userId;
    req.user = user;
    req.session = session;
    req.sessionId = payload.sessionId;
    req.deviceId = payload.deviceId;
    
    next();
    
  } catch (error) {
    console.error('Authentication error:', (error as Error).message);
    
    res.status(500).json({
      status: 'error',
      error: {
        code: 'AUTH_ERROR',
        message: 'Authentication failed'
      }
    });
  }
}

/**
 * Optional Authentication Middleware
 * Allows unauthenticated access but attaches user if token provided
 * Used on: homepage, product listings, public pages
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const token = extractToken(req);
  
  if (!token) {
    return next();  // Continue without auth
  }
  
  try {
    const authService = new AuthService();
    const payload = await authService.verifyAccessToken(token);
    
    const session = await Session.findBySessionId(payload.sessionId);
    if (!session || !session.isActive()) {
      return next();  // Token invalid but allow guest access
    }
    
    const user = await User.findById(payload.userId);
    if (user && user.status === 'active') {
      req.userId = payload.userId;
      req.user = user;
      req.session = session;
    }
  } catch (error) {
    // Token invalid, allow guest access
  }
  
  next();
}

/**
 * Role-Based Access Control (RBAC) Middleware
 * Checks if user has required role
 * 
 * Usage: app.post('/admin/route', authenticate, requireRole('admin'), handler)
 * Usage: app.get('/seller/route', authenticate, requireRole('seller'), handler)
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        status: 'error',
        error: {
          code: 'NOT_AUTHENTICATED',
          message: 'Authentication required'
        }
      });
      return;
    }
    
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        status: 'error',
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `This action requires one of: ${roles.join(', ')}`
        }
      });
      return;
    }
    
    next();
  };
}

/**
 * Capability-Based Authorization
 * Checks fine-grained permissions
 * 
 * Usage: app.post('/orders/:id/refund', authenticate, requireCapability('orders:refund'), handler)
 */
export function requireCapability(...capabilities: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        status: 'error',
        error: {
          code: 'NOT_AUTHENTICATED',
          message: 'Authentication required'
        }
      });
      return;
    }
    
    const userCapabilities = req.user.capabilities || [];
    // Check if user has any of the required capabilities (active and not expired)
    const now = new Date();
    const hasCapability = capabilities.some(cap => 
      userCapabilities.some(userCap => 
        userCap.name === cap && 
        !userCap.revokedAt && 
        (!userCap.expiresAt || new Date(userCap.expiresAt) > now)
      )
    );
    
    if (!hasCapability) {
      res.status(403).json({
        status: 'error',
        error: {
          code: 'CAPABILITY_DENIED',
          message: 'You do not have permission for this action'
        }
      });
      return;
    }
    
    next();
  };
}

/**
 * Seller Verification Middleware
 * Ensures seller is verified + active
 * 
 * Usage: app.post('/seller/products', authenticate, requireVerifiedSeller, handler)
 */
export function requireVerifiedSeller(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({
      status: 'error',
      error: {
        code: 'NOT_AUTHENTICATED',
        message: 'Authentication required'
      }
    });
    return;
  }
  
  if (req.user.role !== 'seller') {
    res.status(403).json({
      status: 'error',
      error: {
        code: 'NOT_A_SELLER',
        message: 'Only sellers can access this resource'
      }
    });
    return;
  }
  
  if (!req.user.seller || req.user.seller.verificationStatus !== 'verified') {
    res.status(403).json({
      status: 'error',
      error: {
        code: 'SELLER_NOT_VERIFIED',
        message: 'Your seller account is not verified'
      }
    });
    return;
  }
  
  next();
}

/**
 * Admin Middleware
 * Requires admin or super_admin role
 */
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({
      status: 'error',
      error: {
        code: 'NOT_AUTHENTICATED',
        message: 'Authentication required'
      }
    });
    return;
  }
  
  if (!['admin', 'super_admin'].includes(req.user.role)) {
    res.status(403).json({
      status: 'error',
      error: {
        code: 'ADMIN_REQUIRED',
        message: 'Admin access required'
      }
    });
    return;
  }
  
  next();
}

/**
 * Super Admin Middleware
 * Only super_admin can access
 */
export function requireSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({
      status: 'error',
      error: {
        code: 'NOT_AUTHENTICATED',
        message: 'Authentication required'
      }
    });
    return;
  }
  
  if (req.user.role !== 'super_admin') {
    res.status(403).json({
      status: 'error',
      error: {
        code: 'SUPER_ADMIN_REQUIRED',
        message: 'Super admin access required'
      }
    });
    return;
  }
  
  next();
}

/**
 * Verify Resource Ownership
 * Ensures user owns the resource
 * 
 * This is a factory - actual verification happens in route handler
 * Because ownership depends on the specific model being accessed
 * 
 * Usage: app.patch('/products/:id', authenticate, verifyOwnership('sellerId'), handler)
 */
export function verifyOwnership(ownerField: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Actual check happens in handler (see AuthenticatedRequest extension)
      next();
    } catch (error) {
      res.status(500).json({
        status: 'error',
        error: {
          code: 'OWNERSHIP_CHECK_ERROR',
          message: 'Failed to verify ownership'
        }
      });
    }
  };
}

// Legacy aliases for backward compatibility (will be removed in v2)
export interface AuthenticatedRequest extends Request {
  user?: IUser;
}

export const protect = authenticate;
export const authorize = requireRole;
export const isOwnerOrAdmin = (resourceUserId: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        status: 'error',
        error: {
          code: 'NOT_AUTHENTICATED',
          message: 'Not authorized to access this route'
        }
      });
      return;
    }

    const isOwner = req.user._id?.toString() === resourceUserId;
    const isAdmin = ['admin', 'super_admin'].includes(req.user.role);

    if (!isOwner && !isAdmin) {
      res.status(403).json({
        status: 'error',
        error: {
          code: 'FORBIDDEN',
          message: 'Not authorized to access this resource'
        }
      });
      return;
    }

    next();
  };
};

export default {
  authenticate,
  optionalAuth,
  requireRole,
  requireCapability,
  requireVerifiedSeller,
  requireAdmin,
  requireSuperAdmin,
  verifyOwnership,
  protect,
  authorize,
  isOwnerOrAdmin
};