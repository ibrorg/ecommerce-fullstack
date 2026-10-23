import mongoose, { Schema, Document } from 'mongoose';

// Stores cached responses for idempotent requests (POST /api/orders with an
// Idempotency-Key header). Prevents duplicate order creation from double-
// submits, network retries, or client crashes. Same pattern as Stripe's
// idempotency keys.
export interface IIdempotencyRecord extends Document {
  key: string;
  userId: mongoose.Types.ObjectId;
  statusCode: number;
  responseBody: unknown;
  createdAt: Date;
}

const idempotencyRecordSchema = new Schema<IIdempotencyRecord>(
  {
    key: {
      type: String,
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    statusCode: {
      type: Number,
      required: true,
    },
    responseBody: {
      type: Schema.Types.Mixed,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: 'idempotency_records',
  }
);

// one key per user — different users can reuse the same key safely
idempotencyRecordSchema.index({ key: 1, userId: 1 }, { unique: true });
// auto-expire after 24 hours (matches Stripe's retention window)
idempotencyRecordSchema.index({ createdAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

export default mongoose.model<IIdempotencyRecord>(
  'IdempotencyRecord',
  idempotencyRecordSchema
);
