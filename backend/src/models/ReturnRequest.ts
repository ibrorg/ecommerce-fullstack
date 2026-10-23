import mongoose, { Schema, Document } from 'mongoose';

export type ReturnStatus = 'requested' | 'approved' | 'rejected' | 'refunded' | 'cancelled';
export type ReturnReason = 'damaged' | 'wrong_item' | 'not_as_described' | 'changed_mind' | 'other';

export interface IReturnItem {
  product: mongoose.Types.ObjectId;
  name: string;
  quantity: number;
  price: number;
  reason: ReturnReason;
}

export interface IReturnRequest extends Document {
  order: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  items: IReturnItem[];
  status: ReturnStatus;
  reason: string;
  photos: string[];
  adminNotes?: string;
  refundAmount?: number;
  refundId?: string;
  requestedAt: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  refundedAt?: Date;
  processedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const returnItemSchema = new Schema<IReturnItem>({
  product: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true, min: 0 },
  reason: {
    type: String,
    enum: ['damaged', 'wrong_item', 'not_as_described', 'changed_mind', 'other'],
    required: true
  }
});

const returnRequestSchema = new Schema<IReturnRequest>(
  {
    order: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    items: [returnItemSchema],
    status: {
      type: String,
      enum: ['requested', 'approved', 'rejected', 'refunded', 'cancelled'],
      default: 'requested',
      index: true
    },
    reason: {
      type: String,
      required: true,
      maxlength: 500
    },
    photos: {
      type: [String],
      default: []
    },
    adminNotes: { type: String, maxlength: 1000 },
    refundAmount: { type: Number, min: 0 },
    refundId: { type: String },
    requestedAt: { type: Date, default: Date.now },
    approvedAt: { type: Date },
    rejectedAt: { type: Date },
    refundedAt: { type: Date },
    processedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true,
    collection: 'return_requests'
  }
);

// compound index for user's returns list
returnRequestSchema.index({ user: 1, createdAt: -1 });
returnRequestSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model<IReturnRequest>('ReturnRequest', returnRequestSchema);
