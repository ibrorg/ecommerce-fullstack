import mongoose, { Document, Schema } from 'mongoose';

export interface IRole extends Document {
  name: string;
  description: string;
  permissions: {
    resource: string;
    actions: string[];
  }[];
  isSystem: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const roleSchema = new Schema<IRole>({
  name: {
    type: String,
    required: [true, 'Role name is required'],
    unique: true,
    trim: true
  },
  description: {
    type: String,
    maxlength: 500
  },
  permissions: [
    {
      resource: {
        type: String,
        enum: ['orders', 'products', 'users', 'sellers', 'payments', 'reports', 'settings', 'dashboard', 'roles'],
        required: true
      },
      actions: {
        type: [String],
        enum: ['view', 'create', 'edit', 'delete', 'manage'],
        required: true
      }
    }
  ],
  isSystem: { type: Boolean, default: false },
  createdBy: mongoose.Schema.Types.ObjectId,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model<IRole>('Role', roleSchema);
