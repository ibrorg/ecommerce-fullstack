import mongoose, { Schema, Document } from 'mongoose';

export type CouponType = 'percentage' | 'flat';

export interface ICoupon extends Document {
  code: string;
  description?: string;
  type: CouponType;
  // for percentage: value is 0-100 (e.g. 20 = 20% off)
  // for flat: value is the flat discount amount in currency units
  value: number;
  minOrder: number;
  maxDiscount: number | null;
  usageLimit: number | null;
  perUserLimit: number;
  usedCount: number;
  validFrom: Date;
  validTo: Date;
  isActive: boolean;
  stackable: boolean;
  // which categories this coupon applies to (empty = all)
  categories: string[];
  createdAt: Date;
  updatedAt: Date;
}

const couponSchema = new Schema<ICoupon>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 30
    },
    description: {
      type: String,
      maxlength: 200
    },
    type: {
      type: String,
      enum: ['percentage', 'flat'],
      required: true
    },
    value: {
      type: Number,
      required: true,
      min: 0
    },
    minOrder: {
      type: Number,
      default: 0,
      min: 0
    },
    maxDiscount: {
      type: Number,
      default: null,
      min: 0
    },
    usageLimit: {
      // null = unlimited
      type: Number,
      default: null,
      min: 1
    },
    perUserLimit: {
      type: Number,
      default: 1,
      min: 1
    },
    usedCount: {
      type: Number,
      default: 0,
      min: 0
    },
    validFrom: {
      type: Date,
      default: Date.now
    },
    validTo: {
      type: Date,
      required: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    stackable: {
      type: Boolean,
      default: false
    },
    categories: {
      type: [String],
      default: []
    }
  },
  {
    timestamps: true,
    collection: 'coupons'
  }
);

// index for active-coupon lookup
couponSchema.index({ code: 1, isActive: 1 });
couponSchema.index({ validTo: 1 });
couponSchema.index({ isActive: 1, validFrom: 1, validTo: 1 });

export default mongoose.model<ICoupon>('Coupon', couponSchema);
