import mongoose, { Schema, Document } from 'mongoose';

export interface IReservation extends Document {
  userId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  quantity: number;
  sessionId: string;
  status: 'active' | 'released' | 'converted';
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const reservationSchema = new Schema<IReservation>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    sessionId: {
      type: String,
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['active', 'released', 'converted'],
      default: 'active',
      index: true
    },
    expiresAt: {
      type: Date,
      required: true
    }
  },
  {
    timestamps: true,
    collection: 'reservations'
  }
);

// TTL index — MongoDB auto-deletes expired reservations after 10 min
// the background cron job restocks on release; this is the safety net
reservationSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

// compound index for availability check: sum of active reservations per product
reservationSchema.index({ productId: 1, status: 1, expiresAt: 1 });

export default mongoose.model<IReservation>('Reservation', reservationSchema);
