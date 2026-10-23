import Razorpay from 'razorpay';
import crypto from 'crypto';
import Order, { IOrder } from '../models/Order';
import { AppError } from '../middleware/errorHandler';

// initialize razorpay — null if keys not configured
const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

const razorpay = razorpayKeyId && razorpayKeySecret
  ? new Razorpay({
      key_id: razorpayKeyId,
      key_secret: razorpayKeySecret
    })
  : null;

export class RazorpayService {
  // create a Razorpay order for the given app order
  async createOrder(orderId: string) {
    if (!razorpay) {
      throw new AppError('Razorpay not configured', 500);
    }

    const order = await Order.findById(orderId);
    if (!order) {
      throw new AppError('Order not found', 404);
    }

    if (order.isPaid) {
      throw new AppError('Order already paid', 400);
    }

    // Razorpay expects amount in paise (1 INR = 100 paise)
    const amountInPaise = Math.round(order.totalPrice * 100);

    const razorpayOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `order_${(order._id as any).toString()}`,
      notes: {
        orderId: (order._id as any).toString(),
        orderNumber: order.orderNumber
      }
    });

    return {
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: razorpayKeyId,
      orderNumber: order.orderNumber
    };
  }

  // verify Razorpay payment signature — timing-safe compare
  verifySignature(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    signature: string
  ): boolean {
    if (!razorpayKeySecret) {
      throw new AppError('Razorpay not configured', 500);
    }

    // signature = HMAC-SHA256(razorpayOrderId + '|' + razorpayPaymentId, keySecret)
    const expectedSignature = crypto
      .createHmac('sha256', razorpayKeySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    // timing-safe comparison to prevent timing attacks
    const expected = Buffer.from(expectedSignature, 'hex');
    const received = Buffer.from(signature, 'hex');

    if (expected.length !== received.length) {
      return false;
    }

    return crypto.timingSafeEqual(expected, received);
  }

  // verify and mark order as paid
  async verifyAndCapture(
    orderId: string,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    signature: string
  ): Promise<IOrder> {
    const isValid = this.verifySignature(razorpayOrderId, razorpayPaymentId, signature);
    if (!isValid) {
      throw new AppError('Invalid payment signature', 400);
    }

    const order = await Order.findById(orderId);
    if (!order) {
      throw new AppError('Order not found', 404);
    }

    if (order.isPaid) {
      throw new AppError('Order already paid', 400);
    }

    order.isPaid = true;
    order.paidAt = new Date();
    order.paymentResult = {
      id: razorpayPaymentId,
      status: 'paid',
      update_time: new Date().toISOString(),
      email_address: ''
    };
    await order.save();

    return order;
  }
}

export default new RazorpayService();
