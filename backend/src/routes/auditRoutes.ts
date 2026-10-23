import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { AuditLog, AuditActionType, ResourceType } from '../models/AuditLog';
import { AuditLogService } from '../services/AuditLogService';
import { PermissionService } from '../services/PermissionService';
import { authenticate, requireRole } from '../middleware/auth';

/**
 * Audit Log Routes
 * 
 * Read-only endpoints for querying audit logs
 * All endpoints require authentication + admin:view-logs capability
 * Audit logs are IMMUTABLE and APPEND-ONLY (cannot be modified or deleted)
 * 
 * Public endpoints: None (all require admin:view-logs)
 * Protected endpoints:
 * - GET /audit/logs - List audit logs with filters
 * - GET /audit/logs/:id - Get single audit log entry
 * - GET /audit/logs/user/:userId - Get all actions by a user
 * - GET /audit/logs/resource/:resourceType/:resourceId - Get all actions on a resource
 * - GET /audit/logs/action/:action - Get all actions of a specific type
 * - GET /audit/logs/suspicious - Get suspicious activities
 */

const router = Router();

/**
 * Middleware: Check for admin:view-logs capability
 */
const requireAuditViewPermission = (
  req: Request & { user?: any },
  res: Response,
  next: Function
): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (!PermissionService.hasCapability(req.user, 'admin:view-logs')) {
    res.status(403).json({
      error: 'Permission denied: requires admin:view-logs capability',
    });
    return;
  }

  next();
};

// ==================== GET /audit/logs ====================
/**
 * List audit logs with advanced filtering
 * 
 * Query parameters:
 * - userId: Filter by actor (user who performed action) (optional)
 * - resourceType: Filter by resource type (User, Order, Product, etc.) (optional)
 * - resourceId: Filter by resource ID (optional, requires resourceType)
 * - action: Filter by action type (LOGIN_SUCCESS, ORDER_CREATED, etc.) (optional)
 * - startDate: Filter by start date (ISO 8601 format, optional)
 * - endDate: Filter by end date (ISO 8601 format, optional)
 * - limit: Max results (default 100, max 1000)
 * - skip: Pagination offset (default 0)
 * - sort: Sort order (createdAt=1 for asc, createdAt=-1 for desc) (default: -1)
 * 
 * Response: Array of audit log entries (IMMUTABLE - for viewing only)
 * 
 * Examples:
 * GET /audit/logs?limit=50 - Recent 50 actions
 * GET /audit/logs?userId=507f1f77bcf86cd799439011 - All actions by user
 * GET /audit/logs?resourceType=Order&resourceId=507f1f77bcf86cd799439011 - All actions on order
 * GET /audit/logs?action=PAYMENT_PROCESSED&limit=100 - All payment actions
 * GET /audit/logs?startDate=2024-01-01&endDate=2024-02-01 - Actions in date range
 */
router.get(
  '/',
  authenticate,
  requireRole('admin', 'super_admin'),
  requireAuditViewPermission,
  async (req: Request & { user?: any }, res: Response): Promise<void> => {
    try {
      const {
        userId,
        resourceType,
        resourceId,
        action,
        startDate,
        endDate,
        limit = '100',
        skip = '0',
        sort = '-1', // -1 for descending (newest first), 1 for ascending (oldest first)
      } = req.query;

      // Validate limit and skip
      const limitNum = Math.min(parseInt(limit as string) || 100, 1000);
      const skipNum = Math.max(parseInt(skip as string) || 0, 0);
      const sortNum = sort === '1' ? 1 : -1;

      if (limitNum < 1) {
        res.status(400).json({ error: 'Invalid limit' });
        return;
      }

      // Build MongoDB query
      const query: any = {};

      // Filter by actor (user who performed the action)
      if (userId && mongoose.Types.ObjectId.isValid(userId as string)) {
        query.actorId = new mongoose.Types.ObjectId(userId as string);
      }

      // Filter by resource type and ID
      if (resourceType) {
        query.resourceType = resourceType;
        if (resourceId && mongoose.Types.ObjectId.isValid(resourceId as string)) {
          query.resourceId = new mongoose.Types.ObjectId(resourceId as string);
        }
      }

      // Filter by action type
      if (action) {
        query.action = action;
      }

      // Filter by date range
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) {
          try {
            query.createdAt.$gte = new Date(startDate as string);
          } catch (e) {
            res.status(400).json({ error: 'Invalid startDate format' });
        return;
          }
        }
        if (endDate) {
          try {
            query.createdAt.$lte = new Date(endDate as string);
          } catch (e) {
            res.status(400).json({ error: 'Invalid endDate format' });
        return;
          }
        }
      }

      // Execute query with sorting and pagination
      const logs = await AuditLog.find(query)
        .sort({ createdAt: sortNum })
        .limit(limitNum)
        .skip(skipNum)
        .lean();

      // Get total count for pagination
      const total = await AuditLog.countDocuments(query);

      res.json({
        data: logs,
        count: logs.length,
        total,
        limit: limitNum,
        skip: skipNum,
        hasMore: skipNum + logs.length < total,
      });
    } catch (error: any) {
      console.error('Error fetching audit logs:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch audit logs' });
    }
  }
);

// ==================== GET /audit/logs/:id ====================
/**
 * Get a single audit log entry by ID
 * 
 * Path parameters:
 * - id: Audit log ID (MongoDB ObjectId)
 * 
 * Response: Single audit log entry with all details
 * 
 * Example:
 * GET /audit/logs/507f1f77bcf86cd799439011
 */
router.get(
  '/:id',
  authenticate,
  requireRole('admin', 'super_admin'),
  requireAuditViewPermission,
  async (req: Request & { user?: any }, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      // Validate ObjectId format
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ error: 'Invalid audit log ID format' });
        return;
      }

      const log = await AuditLog.findById(id)
        .populate('actorId', 'email firstName lastName role')
        .lean();

      if (!log) {
        res.status(404).json({ error: 'Audit log entry not found' });
        return;
      }

      res.json(log);
    } catch (error: any) {
      console.error('Error fetching audit log:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch audit log' });
    }
  }
);

// ==================== GET /audit/logs/user/:userId ====================
/**
 * Get all audit log entries for a specific user (actor)
 * Shows all actions performed by this user
 * 
 * Path parameters:
 * - userId: ID of the user whose actions to retrieve
 * 
 * Query parameters:
 * - limit: Max results (default 100, max 500)
 * - skip: Pagination offset (default 0)
 * - action: Filter by specific action type (optional)
 * 
 * Response: All audit logs where this user is the actor
 * 
 * Example:
 * GET /audit/logs/user/507f1f77bcf86cd799439011?limit=50
 */
router.get(
  '/user/:userId',
  authenticate,
  requireRole('admin', 'super_admin'),
  requireAuditViewPermission,
  async (req: Request & { user?: any }, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const { action, limit = '100', skip = '0' } = req.query;

      // Validate userId format
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        res.status(400).json({ error: 'Invalid user ID format' });
        return;
      }

      // Validate limit and skip
      const limitNum = Math.min(parseInt(limit as string) || 100, 500);
      const skipNum = Math.max(parseInt(skip as string) || 0, 0);

      // Build query
      const query: any = {
        actorId: new mongoose.Types.ObjectId(userId),
      };

      if (action) {
        query.action = action;
      }

      // Fetch logs
      const logs = await AuditLog.find(query)
        .sort({ createdAt: -1 }) // Newest first
        .limit(limitNum)
        .skip(skipNum)
        .lean();

      const total = await AuditLog.countDocuments(query);

      res.json({
        userId,
        data: logs,
        count: logs.length,
        total,
        hasMore: skipNum + logs.length < total,
      });
    } catch (error: any) {
      console.error('Error fetching user audit logs:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch audit logs' });
    }
  }
);

// ==================== GET /audit/logs/resource/:resourceType/:resourceId ====================
/**
 * Get audit log entries for a specific resource
 * Shows all actions that affected this resource
 * Useful for forensics (e.g., "Show me everything that happened to this order")
 * 
 * Path parameters:
 * - resourceType: Type of resource (User, Order, Product, Payment, etc.)
 * - resourceId: ID of the resource
 * 
 * Query parameters:
 * - limit: Max results (default 100, max 500)
 * - skip: Pagination offset (default 0)
 * 
 * Response: All audit logs affecting this resource, sorted by date
 * 
 * Example:
 * GET /audit/logs/resource/Order/507f1f77bcf86cd799439011?limit=50
 */
router.get(
  '/resource/:resourceType/:resourceId',
  authenticate,
  requireRole('admin', 'super_admin'),
  requireAuditViewPermission,
  async (req: Request & { user?: any }, res: Response): Promise<void> => {
    try {
      const { resourceType, resourceId } = req.params;
      const { limit = '100', skip = '0' } = req.query;

      // Validate resourceId format
      if (!mongoose.Types.ObjectId.isValid(resourceId)) {
        res.status(400).json({ error: 'Invalid resource ID format' });
        return;
      }

      // Validate limit and skip
      const limitNum = Math.min(parseInt(limit as string) || 100, 500);
      const skipNum = Math.max(parseInt(skip as string) || 0, 0);

      // Build query
      const query = {
        resourceType,
        resourceId: new mongoose.Types.ObjectId(resourceId),
      };

      // Fetch logs
      const logs = await AuditLog.find(query)
        .sort({ createdAt: -1 }) // Newest first
        .limit(limitNum)
        .skip(skipNum)
        .populate('actorId', 'email firstName lastName role')
        .lean();

      const total = await AuditLog.countDocuments(query);

      res.json({
        resource: { type: resourceType, id: resourceId },
        data: logs,
        count: logs.length,
        total,
        hasMore: skipNum + logs.length < total,
      });
    } catch (error: any) {
      console.error('Error fetching resource audit logs:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch audit logs' });
    }
  }
);

// ==================== GET /audit/logs/action/:action ====================
/**
 * Get all audit log entries of a specific action type
 * Shows all instances when a particular action was performed
 * 
 * Path parameters:
 * - action: Action type (LOGIN_SUCCESS, ORDER_CREATED, USER_SUSPENDED, etc.)
 * 
 * Query parameters:
 * - limit: Max results (default 100, max 500)
 * - skip: Pagination offset (default 0)
 * - startDate: Filter by start date (optional)
 * - endDate: Filter by end date (optional)
 * 
 * Response: All audit logs of this action type
 * 
 * Example:
 * GET /audit/logs/action/LOGIN_FAILURE?limit=50
 * GET /audit/logs/action/FRAUD_ALERT?startDate=2024-01-01&endDate=2024-02-01
 */
router.get(
  '/action/:action',
  authenticate,
  requireRole('admin', 'super_admin'),
  requireAuditViewPermission,
  async (req: Request & { user?: any }, res: Response): Promise<void> => {
    try {
      const { action } = req.params;
      const { limit = '100', skip = '0', startDate, endDate } = req.query;

      // Validate limit and skip
      const limitNum = Math.min(parseInt(limit as string) || 100, 500);
      const skipNum = Math.max(parseInt(skip as string) || 0, 0);

      // Build query
      const query: any = { action };

      // Add date range filter if provided
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) {
          try {
            query.createdAt.$gte = new Date(startDate as string);
          } catch (e) {
            res.status(400).json({ error: 'Invalid startDate format' });
        return;
          }
        }
        if (endDate) {
          try {
            query.createdAt.$lte = new Date(endDate as string);
          } catch (e) {
            res.status(400).json({ error: 'Invalid endDate format' });
        return;
          }
        }
      }

      // Fetch logs
      const logs = await AuditLog.find(query)
        .sort({ createdAt: -1 }) // Newest first
        .limit(limitNum)
        .skip(skipNum)
        .populate('actorId', 'email firstName lastName role')
        .lean();

      const total = await AuditLog.countDocuments(query);

      res.json({
        action,
        data: logs,
        count: logs.length,
        total,
        hasMore: skipNum + logs.length < total,
      });
    } catch (error: any) {
      console.error('Error fetching action audit logs:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch audit logs' });
    }
  }
);

// ==================== GET /audit/logs/suspicious ====================
/**
 * Get suspicious activity entries
 * Shows potential security incidents (brute force attempts, fraud alerts, etc.)
 * 
 * Query parameters:
 * - limit: Max results (default 50, max 500)
 * - skip: Pagination offset (default 0)
 * - hours: Look back how many hours (default 24)
 * 
 * Response: Suspicious activity sorted by recency
 * 
 * Example:
 * GET /audit/logs/suspicious?hours=48&limit=20
 */
router.get(
  '/suspicious',
  authenticate,
  requireRole('admin', 'super_admin'),
  requireAuditViewPermission,
  async (req: Request & { user?: any }, res: Response): Promise<void> => {
    try {
      const { limit = '50', skip = '0', hours = '24' } = req.query;

      // Validate parameters
      const limitNum = Math.min(parseInt(limit as string) || 50, 500);
      const skipNum = Math.max(parseInt(skip as string) || 0, 0);
      const hoursNum = Math.max(parseInt(hours as string) || 24, 1);

      // Calculate time threshold
      const since = new Date();
      since.setHours(since.getHours() - hoursNum);

      // Query for suspicious activities
      const suspiciousActions = [
        AuditActionType.LOGIN_FAILURE,
        AuditActionType.BRUTE_FORCE_BLOCKED,
        AuditActionType.SUSPICIOUS_ACTIVITY_DETECTED,
        AuditActionType.FRAUD_ALERT,
      ];

      const query = {
        action: { $in: suspiciousActions },
        createdAt: { $gte: since },
      };

      // Fetch logs
      const logs = await AuditLog.find(query)
        .sort({ createdAt: -1 })
        .limit(limitNum)
        .skip(skipNum)
        .populate('actorId', 'email firstName lastName role')
        .lean();

      const total = await AuditLog.countDocuments(query);

      res.json({
        data: logs,
        count: logs.length,
        total,
        hoursLookback: hoursNum,
        hasMore: skipNum + logs.length < total,
      });
    } catch (error: any) {
      console.error('Error fetching suspicious audit logs:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch suspicious activities' });
    }
  }
);

export default router;
