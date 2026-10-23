import Reservation, { IReservation } from '../models/Reservation';
import Product from '../models/Product';
import { AppError } from '../middleware/errorHandler';
import mongoose from 'mongoose';

const RESERVATION_TTL_MINUTES = 10;

export class ReservationService {
  // hold stock for a user during checkout — prevents oversell
  // uses optimistic concurrency: create reservation first, then verify total
  // doesn't exceed stock. if it does, delete the reservation and throw.
  async hold(
    userId: string,
    productId: string,
    quantity: number,
    sessionId: string
  ): Promise<IReservation> {
    const product = await Product.findById(productId);
    if (!product) {
      throw new AppError('Product not found', 404);
    }

    if (quantity > product.countInStock) {
      throw new AppError(
        `Insufficient stock for ${product.name}. Stock: ${product.countInStock}, Requested: ${quantity}`,
        409
      );
    }

    // check if this session already has a reservation for this product
    const existing = await Reservation.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      productId: new mongoose.Types.ObjectId(productId),
      sessionId,
      status: 'active'
    });

    if (existing) {
      const newQty = existing.quantity + quantity;
      if (newQty > product.countInStock) {
        throw new AppError(
          `Insufficient stock for ${product.name}`,
          409
        );
      }
      existing.quantity = newQty;
      existing.expiresAt = new Date(Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000);
      await existing.save();
      return existing;
    }

    // optimistic concurrency: create the reservation first
    const reservation = await Reservation.create({
      userId: new mongoose.Types.ObjectId(userId),
      productId: new mongoose.Types.ObjectId(productId),
      quantity,
      sessionId,
      status: 'active',
      expiresAt: new Date(Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000)
    });

    // now verify: total active reservations for this product <= stock
    // this check runs AFTER create, so concurrent creates will see each other
    const totalReserved = await this.getReservedQuantity(productId);

    if (totalReserved > product.countInStock) {
      // over-committed — delete our reservation and fail
      await Reservation.deleteOne({ _id: reservation._id });
      throw new AppError(
        `Insufficient stock for ${product.name}. Available: ${product.countInStock - (totalReserved - quantity)}`,
        409
      );
    }

    return reservation;
  }

  // release a reservation — restocks the product
  async release(reservationId: string): Promise<void> {
    const reservation = await Reservation.findById(reservationId);
    if (!reservation || reservation.status !== 'active') {
      return;
    }

    reservation.status = 'released';
    await reservation.save();
  }

  // release all active reservations for a session (e.g., on checkout abandon)
  async releaseBySession(sessionId: string): Promise<void> {
    await Reservation.updateMany(
      { sessionId, status: 'active' },
      { $set: { status: 'released' } }
    );
  }

  // convert active reservations to 'converted' — called after order is placed
  // the stock decrement happens in the order transaction, so we just mark
  async convertBySession(sessionId: string): Promise<void> {
    await Reservation.updateMany(
      { sessionId, status: 'active' },
      { $set: { status: 'converted' } }
    );
  }

  // get total reserved quantity for a product
  // optionally exclude a specific session (for "hold more" checks)
  async getReservedQuantity(
    productId: string,
    excludeUserId?: string,
    excludeSessionId?: string
  ): Promise<number> {
    const filter: any = {
      productId: new mongoose.Types.ObjectId(productId),
      status: 'active',
      expiresAt: { $gt: new Date() }
    };

    if (excludeUserId) {
      filter.userId = { $ne: new mongoose.Types.ObjectId(excludeUserId) };
    }
    if (excludeSessionId) {
      filter.sessionId = { $ne: excludeSessionId };
    }

    const result = await Reservation.aggregate([
      { $match: filter },
      { $group: { _id: null, total: { $sum: '$quantity' } } }
    ]);

    return result.length > 0 ? result[0].total : 0;
  }

  // get available stock = countInStock - active reservations
  async getAvailableStock(productId: string): Promise<number> {
    const product = await Product.findById(productId);
    if (!product) return 0;

    const reserved = await this.getReservedQuantity(productId);
    return Math.max(0, product.countInStock - reserved);
  }

  // background job — release expired active reservations and restock
  // called by node-cron every 60 seconds
  async releaseExpired(): Promise<number> {
    const expired = await Reservation.find({
      status: 'active',
      expiresAt: { $lt: new Date() }
    });

    let count = 0;
    for (const reservation of expired) {
      reservation.status = 'released';
      await reservation.save();
      count++;
    }

    return count;
  }

  // get active reservations for a user/session (for checkout summary)
  async getSessionReservations(sessionId: string): Promise<IReservation[]> {
    return Reservation.find({
      sessionId,
      status: 'active',
      expiresAt: { $gt: new Date() }
    }).populate('productId', 'name price images');
  }
}

export default new ReservationService();
