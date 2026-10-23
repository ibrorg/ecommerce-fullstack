import mongoose, { Document, Schema } from 'mongoose';

export type AddressLabel = 'Home' | 'Work' | 'Other';

export interface IAddress extends Document {
  user: mongoose.Types.ObjectId;
  label: AddressLabel;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  landmark?: string;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const addressSchema = new Schema<IAddress>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Address must belong to a user'],
      index: true
    },
    label: {
      type: String,
      enum: {
        values: ['Home', 'Work', 'Other'],
        message: '{VALUE} is not a valid label'
      },
      default: 'Home'
    },
    fullName: {
      type: String,
      required: [true, 'Recipient name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      validate: {
        validator: function (v: string) {
          return /^[+]?[\d\s-]{7,15}$/.test(v);
        },
        message: 'Please provide a valid phone number'
      }
    },
    line1: {
      type: String,
      required: [true, 'Address line 1 is required'],
      trim: true,
      maxlength: [200, 'Address line cannot exceed 200 characters']
    },
    line2: {
      type: String,
      trim: true,
      maxlength: [200, 'Address line cannot exceed 200 characters']
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true
    },
    postalCode: {
      type: String,
      required: [true, 'Postal code is required'],
      trim: true,
      uppercase: true
    },
    country: {
      type: String,
      default: 'India',
      trim: true
    },
    landmark: {
      type: String,
      trim: true,
      maxlength: [100, 'Landmark cannot exceed 100 characters']
    },
    isDefaultShipping: {
      type: Boolean,
      default: false
    },
    isDefaultBilling: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    collection: 'addresses'
  }
);

// one default shipping + one default billing per user
addressSchema.index({ user: 1, isDefaultShipping: 1 });
addressSchema.index({ user: 1, isDefaultBilling: 1 });

export default mongoose.model<IAddress>('Address', addressSchema);
