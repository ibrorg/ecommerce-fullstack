import Coupon, { ICoupon } from '../models/Coupon';
import Order from '../models/Order';
import { AppError } from '../middleware/errorHandler';

export interface CouponValidationResult {
  valid: boolean;
  coupon?: ICoupon;
  discountAmount?: number;
  error?: string;
}

export class CouponService {
  // validate a coupon against an order without redeeming it
  // used by the checkout "apply coupon" preview
  async validate(
    code: string,
    itemsPrice: number,
    userId: string,
    categories: string[] = []
  ): Promise<CouponValidationResult> {
    const coupon = await Coupon.findOne({
      code: code.toUpperCase().trim(),
      isActive: true
    });

    if (!coupon) {
      return { valid: false, error: 'Coupon not found or inactive' };
    }

    const now = new Date();
    if (now < coupon.validFrom) {
      return { valid: false, error: 'Coupon is not yet active' };
    }
    if (now > coupon.validTo) {
      return { valid: false, error: 'Coupon has expired' };
    }

    if (itemsPrice < coupon.minOrder) {
      return {
        valid: false,
        error: `Minimum order amount is ${coupon.minOrder}`
      };
    }

    // category restriction
    if (coupon.categories.length > 0) {
      const hasMatchingCategory = categories.some((c) =>
        coupon.categories.includes(c)
      );
      if (!hasMatchingCategory) {
        return {
          valid: false,
          error: 'Coupon not applicable to items in cart'
        };
      }
    }

    // usage limit check
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      return { valid: false, error: 'Coupon usage limit reached' };
    }

    // per-user limit
    const userUsageCount = await Order.countDocuments({
      'appliedCoupon.code': coupon.code,
      user: userId
    });
    if (userUsageCount >= coupon.perUserLimit) {
      return {
        valid: false,
        error: `You have already used this coupon ${userUsageCount} time(s)`
      };
    }

    const discountAmount = this.calculateDiscount(coupon, itemsPrice);

    return { valid: true, coupon, discountAmount };
  }

  // compute discount amount — never trust client-sent discount
  calculateDiscount(coupon: ICoupon, itemsPrice: number): number {
    let discount = 0;
    if (coupon.type === 'percentage') {
      discount = (itemsPrice * coupon.value) / 100;
      if (coupon.maxDiscount !== null && discount > coupon.maxDiscount) {
        discount = coupon.maxDiscount;
      }
    } else {
      // flat
      discount = coupon.value;
    }

    // never discount below zero
    if (discount > itemsPrice) {
      discount = itemsPrice;
    }

    return Math.round(discount * 100) / 100;
  }

  // atomically increment usage count — prevents over-redemption under concurrency
  async redeem(couponId: string): Promise<void> {
    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      throw new AppError('Coupon not found', 404);
    }

    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      throw new AppError('Coupon usage limit reached', 400);
    }

    // atomic conditional increment — prevents race between two concurrent redemptions
    const result = await Coupon.updateOne(
      {
        _id: couponId,
        $or: [
          { usageLimit: null },
          { usedCount: { $lt: coupon.usageLimit } }
        ]
      },
      { $inc: { usedCount: 1 } }
    );

    if (result.modifiedCount === 0) {
      throw new AppError('Coupon usage limit reached', 400);
    }
  }

  // admin CRUD helpers
  async list(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [coupons, total] = await Promise.all([
      Coupon.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
      Coupon.countDocuments()
    ]);
    return {
      coupons,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    };
  }

  async create(data: Partial<ICoupon>): Promise<ICoupon> {
    const existing = await Coupon.findOne({ code: data.code?.toUpperCase() });
    if (existing) {
      throw new AppError('Coupon with this code already exists', 400);
    }
    return Coupon.create(data);
  }

  async update(id: string, data: Partial<ICoupon>): Promise<ICoupon> {
    const coupon = await Coupon.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true
    });
    if (!coupon) {
      throw new AppError('Coupon not found', 404);
    }
    return coupon;
  }

  async delete(id: string): Promise<void> {
    const result = await Coupon.findByIdAndDelete(id);
    if (!result) {
      throw new AppError('Coupon not found', 404);
    }
  }
}

export default new CouponService();
