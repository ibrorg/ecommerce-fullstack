import mongoose, { Schema, Document } from 'mongoose';

// tracks Stripe webhook events we've already processed
// prevents double-processing on Stripe retry bursts
export interface IProcessedWebhookEvent extends Document {
  eventId: string;
  eventType: string;
  processedAt: Date;
}

const processedWebhookEventSchema = new Schema<IProcessedWebhookEvent>(
  {
    eventId: {
      type: String,
      required: true,
      unique: true
    },
    eventType: {
      type: String,
      required: true
    },
    processedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: false,
    collection: 'processed_webhook_events'
  }
);

// auto-expire records after 30 days — Stripe doesn't retry beyond that
processedWebhookEventSchema.index(
  { processedAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 }
);

export default mongoose.model<IProcessedWebhookEvent>(
  'ProcessedWebhookEvent',
  processedWebhookEventSchema
);
