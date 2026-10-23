import mongoose, { Document, Schema } from 'mongoose';
import { IAdminPreference } from './SiteConfig';

const adminPreferenceSchema = new Schema({
  adminId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true, ref: 'User' },
  dashboardWidgets: [
    {
      id: String,
      name: String,
      enabled: Boolean,
      position: Number,
      size: { type: String, enum: ['small', 'medium', 'large'] }
    }
  ],
  defaultView: {
    type: String,
    enum: ['overview', 'products', 'orders', 'users', 'sellers', 'analytics'],
    default: 'overview'
  },
  autoRefreshInterval: { type: Number, default: 30000 },
  itemsPerPage: { type: Number, default: 10 },
  notifications: {
    emailDigest: { type: Boolean, default: true },
    digestFrequency: { type: String, enum: ['daily', 'weekly', 'monthly'], default: 'daily' }
  },
  savedFilters: [
    {
      name: String,
      type: String,
      filters: mongoose.Schema.Types.Mixed
    }
  ],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model<IAdminPreference>('AdminPreference', adminPreferenceSchema);
