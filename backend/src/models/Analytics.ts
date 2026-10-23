import mongoose, { Document, Schema } from 'mongoose';

export interface ISaleMetric {
  date: Date;
  orders: number;
  revenue: number;
  profit: number;
}

export interface IAnalytics extends Document {
  type: 'global' | 'store' | 'product';
  storeId?: mongoose.Types.ObjectId;
  productId?: mongoose.Types.ObjectId;
  totalOrders: number;
  totalRevenue: number;
  totalProfit: number;
  averageOrderValue: number;
  topProducts: Array<{
    productId: mongoose.Types.ObjectId;
    name: string;
    sold: number;
    revenue: number;
  }>;
  topCategories: Array<{
    category: string;
    sold: number;
    revenue: number;
  }>;
  topCustomers: Array<{
    userId: mongoose.Types.ObjectId;
    name: string;
    spent: number;
    orders: number;
  }>;
  saleMetrics: ISaleMetric[];
  conversionRate: number;
  returnRate: number;
  customerSatisfaction: number;
  lastUpdated: Date;
  createdAt: Date;
  updatedAt: Date;
}

const saleMetricSchema = new Schema({
  date: { type: Date, required: true },
  orders: { type: Number, default: 0 },
  revenue: { type: Number, default: 0 },
  profit: { type: Number, default: 0 }
});

const analyticsSchema: Schema = new Schema(
  {
    type: {
      type: String,
      enum: ['global', 'store', 'product'],
      required: true
    },
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store'
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product'
    },
    totalOrders: {
      type: Number,
      default: 0
    },
    totalRevenue: {
      type: Number,
      default: 0
    },
    totalProfit: {
      type: Number,
      default: 0
    },
    averageOrderValue: {
      type: Number,
      default: 0
    },
    topProducts: [
      {
        productId: Schema.Types.ObjectId,
        name: String,
        sold: Number,
        revenue: Number
      }
    ],
    topCategories: [
      {
        category: String,
        sold: Number,
        revenue: Number
      }
    ],
    topCustomers: [
      {
        userId: Schema.Types.ObjectId,
        name: String,
        spent: Number,
        orders: Number
      }
    ],
    saleMetrics: [saleMetricSchema],
    conversionRate: {
      type: Number,
      default: 0
    },
    returnRate: {
      type: Number,
      default: 0
    },
    customerSatisfaction: {
      type: Number,
      default: 5
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

// Indexes
analyticsSchema.index({ type: 1, storeId: 1 });
analyticsSchema.index({ productId: 1 });
analyticsSchema.index({ createdAt: -1 });

export default mongoose.model<IAnalytics>('Analytics', analyticsSchema);
