import express, { Response } from 'express';
import { protect } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendError } from '../utils/response';
import inAppNotificationService from '../services/inAppNotificationService';

const router = express.Router();

// All routes require auth
router.use(protect);

// @route   GET /api/notifications
// @desc    Get user's in-app notifications (paginated)
// @access  Private
router.get(
  '/',
  asyncHandler(async (req: any, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const unreadOnly = req.query.unreadOnly === 'true';
    const result = await inAppNotificationService.getUserNotifications(
      req.user._id.toString(),
      page,
      limit,
      unreadOnly
    );
    sendSuccess(res, 200, result, 'Notifications retrieved');
  })
);

// @route   GET /api/notifications/unread-count
// @desc    Get count of unread notifications
// @access  Private
router.get(
  '/unread-count',
  asyncHandler(async (req: any, res: Response) => {
    const count = await inAppNotificationService.getUnreadCount(req.user._id.toString());
    sendSuccess(res, 200, { count }, 'Unread count retrieved');
  })
);

// @route   PUT /api/notifications/:id/read
// @desc    Mark a single notification as read
// @access  Private
router.put(
  '/:id/read',
  asyncHandler(async (req: any, res: Response) => {
    const notification = await inAppNotificationService.markAsRead(
      req.params.id,
      req.user._id.toString()
    );
    sendSuccess(res, 200, notification, 'Notification marked as read');
  })
);

// @route   PUT /api/notifications/read-all
// @desc    Mark all notifications as read
// @access  Private
router.put(
  '/read-all',
  asyncHandler(async (req: any, res: Response) => {
    const count = await inAppNotificationService.markAllAsRead(req.user._id.toString());
    sendSuccess(res, 200, { marked: count }, `${count} notifications marked as read`);
  })
);

// @route   DELETE /api/notifications/:id
// @desc    Delete a notification
// @access  Private
router.delete(
  '/:id',
  asyncHandler(async (req: any, res: Response) => {
    await inAppNotificationService.deleteNotification(
      req.params.id,
      req.user._id.toString()
    );
    sendSuccess(res, 200, null, 'Notification deleted');
  })
);

export default router;
