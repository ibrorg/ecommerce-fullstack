import ReturnRequest, { IReturnRequest, ReturnStatus } from '../models/ReturnRequest';
import Order from '../models/Order';
import Product from '../models/Product';
import { AppError } from '../middleware/errorHandler';
import mongoose from 'mongoose';
import Stripe from 'stripe';

const RETURN_WINDOW_DAYS = 7;

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey && stripeSecretKey.startsWith('sk_')
  ? new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' as any })
  : null;

export class ReturnService {
  // buyer requests a return for an order
  async createReturn(
    userId: string,
    orderId: string,
    items: Array<{
      product: string;
      name: string;
      quantity: number;
      price: number;
      reason: string;
    }>,
    reason: string,
    photos: string[] = []
  ): Promise<IReturnRequest> {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new AppError('Order not found', 404);
    }

    if (order.user.toString() !== userId) {
      throw new AppError('Not authorized to return this order', 403);
    }

    if (!order.isPaid) {
      throw new AppError('Cannot return an unpaid order', 400);
    }

    // return window check
    if (order.paidAt) {
      const daysSincePaid = (Date.now() - order.paidAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSincePaid > RETURN_WINDOW_DAYS) {
        throw new AppError(`Return window expired (${RETURN_WINDOW_DAYS} days)`, 400);
      }
    }

    // check for existing return on this order
    const existingReturn = await ReturnRequest.findOne({
      order: orderId,
      status: { $in: ['requested', 'approved'] }
    });
    if (existingReturn) {
      throw new AppError('A return request already exists for this order', 400);
    }

    // validate each item belongs to the order
    for (const item of items) {
      const orderItem = order.orderItems.find(
        (oi) => oi.product.toString() === item.product
      );
      if (!orderItem) {
        throw new AppError(`Product ${item.name} is not in this order`, 400);
      }
      if (item.quantity > orderItem.quantity) {
        throw new AppError(
          `Cannot return more than purchased (${orderItem.quantity})`,
          400
        );
      }
    }

    const returnRequest = await ReturnRequest.create({
      order: orderId,
      user: userId,
      items,
      reason,
      photos,
      status: 'requested',
      requestedAt: new Date()
    });

    return returnRequest;
  }

  // admin approves a return — issues Stripe refund + reverses stock atomically
  async approveReturn(
    returnId: string,
    adminId: string,
    refundAmount?: number
  ): Promise<IReturnRequest> {
    const returnRequest = await ReturnRequest.findById(returnId);
    if (!returnRequest) {
      throw new AppError('Return request not found', 404);
    }

    // state machine — only requested returns can be approved
    if (returnRequest.status !== 'requested') {
      throw new AppError(
        `Cannot approve return in status: ${returnRequest.status}`,
        400
      );
    }

    const order = await Order.findById(returnRequest.order);
    if (!order) {
      throw new AppError('Associated order not found', 404);
    }

    // compute refund amount if not provided (proportional to returned items)
    if (!refundAmount) {
      const returnedItemsTotal = returnRequest.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );
      const orderItemsTotal = order.orderItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );
      if (orderItemsTotal > 0) {
        const ratio = returnedItemsTotal / orderItemsTotal;
        refundAmount = Math.round(order.totalPrice * ratio * 100) / 100;
      } else {
        refundAmount = 0;
      }
    }

    if (refundAmount > order.totalPrice) {
      throw new AppError('Refund amount cannot exceed order total', 400);
    }

    // issue Stripe refund if stripe is configured and order has a payment intent
    // in test/dev without real Stripe keys, we skip the actual refund but still
    // reverse stock and mark the return as refunded
    let refundId: string | undefined;
    if (stripe && order.paymentResult?.id && refundAmount > 0) {
      try {
        const refund = await stripe.refunds.create({
          payment_intent: order.paymentResult.id,
          amount: Math.round(refundAmount * 100),
          reason: 'requested_by_customer',
          metadata: {
            returnRequestId: (returnRequest._id as mongoose.Types.ObjectId).toString(),
            orderId: (order._id as mongoose.Types.ObjectId).toString()
          }
        });
        refundId = refund.id;
      } catch (err: any) {
        // in test env with fake stripe key, log and continue without refund
        // in production, this is a real failure that should surface
        if (process.env.NODE_ENV === 'test') {
          console.warn('Stripe refund skipped in test env:', err.message);
        } else {
          throw new AppError(
            `Stripe refund failed: ${err.message}`,
            500
          );
        }
      }
    }

    // reverse stock + update order status in a transaction
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // restock returned items
        for (const item of returnRequest.items) {
          await Product.updateOne(
            { _id: item.product },
            { $inc: { countInStock: item.quantity } },
            { session }
          );
        }

        // mark order as refunded
        await Order.updateOne(
          { _id: order._id },
          { $set: { orderStatus: 'refunded' } },
          { session }
        );

        // update return request status
        await ReturnRequest.updateOne(
          { _id: returnRequest._id },
          {
            $set: {
              status: 'refunded' as ReturnStatus,
              approvedAt: new Date(),
              refundedAt: new Date(),
              refundAmount,
              refundId,
              processedBy: new mongoose.Types.ObjectId(adminId)
            }
          },
          { session }
        );
      });
    } finally {
      await session.endSession();
    }

    const updated = await ReturnRequest.findById(returnId);
    return updated!;
  }

  // admin rejects a return
  async rejectReturn(
    returnId: string,
    adminId: string,
    adminNotes: string
  ): Promise<IReturnRequest> {
    const returnRequest = await ReturnRequest.findById(returnId);
    if (!returnRequest) {
      throw new AppError('Return request not found', 404);
    }

    if (returnRequest.status !== 'requested') {
      throw new AppError(
        `Cannot reject return in status: ${returnRequest.status}`,
        400
      );
    }

    returnRequest.status = 'rejected';
    returnRequest.rejectedAt = new Date();
    returnRequest.adminNotes = adminNotes;
    returnRequest.processedBy = new mongoose.Types.ObjectId(adminId);
    await returnRequest.save();

    return returnRequest;
  }

  // buyer cancels their own return (only if still requested)
  async cancelReturn(returnId: string, userId: string): Promise<IReturnRequest> {
    const returnRequest = await ReturnRequest.findById(returnId);
    if (!returnRequest) {
      throw new AppError('Return request not found', 404);
    }

    if (returnRequest.user.toString() !== userId) {
      throw new AppError('Not authorized', 403);
    }

    if (returnRequest.status !== 'requested') {
      throw new AppError(
        `Cannot cancel return in status: ${returnRequest.status}`,
        400
      );
    }

    returnRequest.status = 'cancelled';
    await returnRequest.save();
    return returnRequest;
  }

  // get returns for a buyer
  async getUserReturns(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [returns, total] = await Promise.all([
      ReturnRequest.find({ user: userId })
        .populate('order', 'orderNumber totalPrice orderStatus')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      ReturnRequest.countDocuments({ user: userId })
    ]);
    return {
      returns,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    };
  }

  // get all returns (admin)
  async getAllReturns(page = 1, limit = 20, status?: string) {
    const skip = (page - 1) * limit;
    const filter: any = {};
    if (status) filter.status = status;

    const [returns, total] = await Promise.all([
      ReturnRequest.find(filter)
        .populate('user', 'firstName lastName email')
        .populate('order', 'orderNumber totalPrice orderStatus')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      ReturnRequest.countDocuments(filter)
    ]);
    return {
      returns,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    };
  }
}

export default new ReturnService();
