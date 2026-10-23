import mongoose, { Document, Schema } from 'mongoose';

export interface ISellerReply {
  comment: string;
  repliedAt: Date;
  repliedBy: mongoose.Types.ObjectId;
}

export interface IReview {
  user: mongoose.Types.ObjectId;
  name: string;
  rating: number;
  comment: string;
  photos: string[];
  helpfulVotes: number;
  votedBy: mongoose.Types.ObjectId[];
  isVerifiedPurchase: boolean;
  sellerReply?: ISellerReply;
  createdAt: Date;
  updatedAt?: Date;
}

export interface IProduct extends Document {
  name: string;
  slug: string;
  description: string;
  price: number;
  comparePrice?: number;
  images: string[];
  category: string;
  subcategory?: string;
  brand?: string;
  countInStock: number;
  isActive: boolean;
  isFeatured: boolean;
  sku: string;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  tags: string[];
  reviews: IReview[];
  numReviews: number;
  rating: number;
  seoTitle?: string;
  seoDescription?: string;
  // seller link, populated on create from req.user
  createdBy: mongoose.Types.ObjectId;
  // soft delete for catalog items
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const sellerReplySchema: Schema = new Schema({
  comment: {
    type: String,
    required: true,
    maxlength: [1000, 'Reply cannot exceed 1000 characters']
  },
  repliedAt: {
    type: Date,
    default: Date.now
  },
  repliedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { _id: false });

const reviewSchema: Schema = new Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  name: {
    type: String,
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    required: true,
    maxlength: [500, 'Comment cannot be more than 500 characters']
  },
  photos: {
    type: [String],
    default: [],
    validate: {
      validator: function(photos: string[]) {
        return photos.length <= 5;
      },
      message: 'A review can have at most 5 photos'
    }
  },
  helpfulVotes: {
    type: Number,
    default: 0,
    min: 0
  },
  votedBy: {
    type: [mongoose.Schema.Types.ObjectId],
    default: [],
    ref: 'User'
  },
  isVerifiedPurchase: {
    type: Boolean,
    default: false
  },
  sellerReply: sellerReplySchema
}, {
  timestamps: true
});

const productSchema: Schema = new Schema({
  name: {
    type: String,
    required: [true, 'Please add a product name'],
    trim: true,
    maxlength: [100, 'Product name cannot be more than 100 characters']
  },
  slug: {
    type: String,
    lowercase: true
  },
  description: {
    type: String,
    required: [true, 'Please add a description'],
    maxlength: [2000, 'Description cannot be more than 2000 characters']
  },
  price: {
    type: Number,
    required: [true, 'Please add a price'],
    min: [0, 'Price cannot be negative'],
    // round to 2 decimals on save to avoid float drift
    set: (v: number) => Math.round((v + Number.EPSILON) * 100) / 100
  },
  comparePrice: {
    type: Number,
    min: [0, 'Compare price cannot be negative'],
    set: (v: number) => Math.round((v + Number.EPSILON) * 100) / 100
  },
  images: {
    type: [String],
    required: [true, 'Please add at least one image'],
    validate: {
      validator: function(images: string[]) {
        return images.length > 0;
      },
      message: 'Product must have at least one image'
    }
  },
  category: {
    type: String,
    required: [true, 'Please add a category'],
    trim: true
  },
  subcategory: {
    type: String,
    trim: true
  },
  brand: {
    type: String,
    trim: true
  },
  countInStock: {
    type: Number,
    required: [true, 'Please add stock count'],
    min: [0, 'Stock count cannot be negative'],
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  sku: {
    type: String,
    required: [true, 'Please add a SKU'],
    unique: true,
    uppercase: true
  },
  weight: {
    type: Number,
    min: [0, 'Weight cannot be negative']
  },
  dimensions: {
    length: {
      type: Number,
      min: [0, 'Length cannot be negative']
    },
    width: {
      type: Number,
      min: [0, 'Width cannot be negative']
    },
    height: {
      type: Number,
      min: [0, 'Height cannot be negative']
    }
  },
  tags: {
    type: [String],
    default: []
  },
  reviews: [reviewSchema],
  numReviews: {
    type: Number,
    default: 0
  },
  rating: {
    type: Number,
    default: 0,
    min: [0, 'Rating cannot be negative'],
    max: [5, 'Rating cannot be more than 5']
  },
  seoTitle: {
    type: String,
    maxlength: [60, 'SEO title cannot be more than 60 characters']
  },
  seoDescription: {
    type: String,
    maxlength: [160, 'SEO description cannot be more than 160 characters']
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// slug from name
productSchema.pre<IProduct>('save', function(next) {
  if (this.isModified('name')) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-zA-Z0-9 ]/g, '')
      .replace(/\s+/g, '-');
  }
  next();
});

// recompute rating on review changes
productSchema.pre<IProduct>('save', function(next) {
  if (this.isModified('reviews')) {
    this.numReviews = this.reviews.length;

    if (this.reviews.length > 0) {
      const totalRating = this.reviews.reduce((acc: number, review: IReview) => acc + review.rating, 0);
      this.rating = Math.round((totalRating / this.reviews.length) * 10) / 10;
    } else {
      this.rating = 0;
    }
  }
  next();
});

// soft delete: hide deleted by default, allow override via setOptions({ includeDeleted: true })
const softDeleteFilter = function(this: any) {
  if (this.getOptions && this.getOptions().includeDeleted === true) return;
  // only apply when no explicit deletedAt condition present
  const existing = this.getQuery().deletedAt;
  if (existing === undefined) {
    this.where({ deletedAt: null });
  }
};
productSchema.pre('find', softDeleteFilter);
productSchema.pre('findOne', softDeleteFilter);
productSchema.pre('findOneAndUpdate', softDeleteFilter);

// indexes
productSchema.index({ slug: 1 }, { unique: true, sparse: true });
productSchema.index({ name: 'text', description: 'text', tags: 'text' });
productSchema.index({ category: 1, subcategory: 1 });
productSchema.index({ price: 1 });
productSchema.index({ rating: -1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ isActive: 1, isFeatured: 1 });
// seller dashboard query index
productSchema.index({ createdBy: 1, isActive: 1, createdAt: -1 });
// compound index for filtered catalog scans (audit recommendation)
productSchema.index({ isActive: 1, deletedAt: 1, category: 1, price: 1 });
// brand filtering (multi-brand filter feature)
productSchema.index({ brand: 1 });
// in-stock filtering
productSchema.index({ countInStock: 1 });

export default mongoose.model<IProduct>('Product', productSchema);
