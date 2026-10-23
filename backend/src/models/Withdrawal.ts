import mongoose, { Document, Schema } from 'mongoose';

export interface IWithdrawal extends Document {
  seller: mongoose.Types.ObjectId;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  bankDetails: {
    accountName: string;
    accountNumber: string;
    routingNumber: string;
    bankName: string;
  };
  transactionId?: string;
  notes?: string;
  rejectionReason?: string;
  requestedAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const withdrawalSchema: Schema = new Schema(
  {
    seller: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: [100, 'Minimum withdrawal amount is $100']
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'rejected'],
      default: 'pending'
    },
    bankDetails: {
      accountName: String,
      accountNumber: String,
      routingNumber: String,
      bankName: String
    },
    transactionId: String,
    notes: String,
    rejectionReason: String,
    requestedAt: {
      type: Date,
      default: Date.now
    },
    processedAt: Date,
    completedAt: Date
  },
  { timestamps: true }
);

// Indexes
withdrawalSchema.index({ seller: 1, createdAt: -1 });
withdrawalSchema.index({ status: 1 });
withdrawalSchema.index({ createdAt: -1 });

export default mongoose.model<IWithdrawal>('Withdrawal', withdrawalSchema);
