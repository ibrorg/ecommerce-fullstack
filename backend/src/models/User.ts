/**
 * User Model (Enterprise-Grade)
 * ==============================
 * 
 * Core user entity for the platform
 * Supports: Buyers, Sellers, Admins, Super Admins
 * 
 * SECURITY FEATURES:
 * - Argon2id password hashing (not bcrypt)
 * - Minimum 12-character passwords with complexity
 * - Failed login tracking + account lockout
 * - Password history (prevent reuse)
 * - Email verification required
 * - 2FA support (TOTP)
 * - Device tracking + trusted device list
 * - Session management
 * - Account suspension with reasons
 * - Seller verification workflow
 * - Soft deletes (GDPR compliance)
 * 
 * NEVER:
 * - Return passwordHash in API responses
 * - Modify role outside of admin services
 * - Trust client-side validation
 */

import mongoose, { Document, Schema } from 'mongoose';
import { hashPassword, verifyPassword } from '../utils/crypto';

export interface ITrustedDevice {
  deviceId: string;        // SHA256(userAgent + IP + timezone)
  userAgent: string;       // Browser/client identifier
  ipAddress: string;       // IPv4 or IPv6
  lastUsedAt: Date;        // When device last logged in
  createdAt: Date;         // When device was first registered
}

export interface ICapabilityGrant {
  name: string;            // Capability name (e.g., 'admin:view-logs')
  grantedAt: Date;         // When the capability was granted
  grantedBy: string;       // User ID who granted
  reason?: string;         // Why this capability was granted
  expiresAt?: Date;        // Optional: auto-revoke after this date
  revokedAt?: Date;        // When revoked (if revoked)
  revokedBy?: string;      // User ID who revoked
  revokedReason?: string;  // Why it was revoked
}

export interface ISellerProfile {
  businessName: string;
  businessLicense: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  verifiedAt?: Date;
  verifiedBy?: mongoose.Types.ObjectId;  // Admin who verified
  trustScore: number;      // 0-100, based on delivery + refunds + reviews
  commissionRate: number;  // Platform commission %
  payoutMethod: 'bank_transfer' | 'stripe' | 'paypal';
  payoutDetails: {
    bankName?: string;
    accountNumber?: string;
    routingNumber?: string;
    // DO NOT STORE FULL NUMBERS - use encrypted vault
  };
  totalEarnings: number;
  pendingEarnings: number;
  withdrawnEarnings: number;
}

export interface IUser extends Document {
  // Identity
  email: string;
  passwordHash: string;    // Argon2id hash (never plaintext)
  firstName: string;
  lastName: string;
  phone?: string;
  avatar?: string;
  
  // Role & Permissions
  role: 'buyer' | 'seller' | 'admin' | 'super_admin' | 'system';
  capabilities: ICapabilityGrant[];  // Fine-grained permissions with tracking
  
  // Email Verification
  isEmailVerified: boolean;
  emailVerificationToken?: string;
  emailVerifiedAt?: Date;
  
  // Password Security
  passwordChangedAt?: Date;
  passwordHistory: string[];          // Last 5 hashes (prevent reuse)
  passwordResetToken?: string;
  passwordResetExpiresAt?: Date;
  minPasswordLength: number;           // Enforced per policy
  requiresPasswordChange: boolean;     // Force change on next login
  
  // Account Status
  status: 'active' | 'inactive' | 'suspended' | 'deleted';
  suspensionReason?: string;
  suspendedAt?: Date;
  suspendedBy?: mongoose.Types.ObjectId;  // Admin who suspended
  
  // 2FA
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;            // TOTP secret (encrypted)
  backupCodes?: string[];              // Backup codes (hashed)
  
  // Device & Session Tracking
  trustedDevices: ITrustedDevice[];
  lastLoginAt?: Date;
  lastLoginIp?: string;
  
  // Failed Login Tracking
  failedLoginAttempts: number;
  lastFailedLoginAt?: Date;
  lastSuccessfulLoginAt?: Date;
  loginLockedUntil?: Date;            // Time-based lockout
  
  // Fraud & Security
  suspicious: boolean;                // Flag for manual review
  ipAddressWhitelist?: string[];      // Allowed IPs
  ipAddressBlacklist?: string[];      // Blocked IPs

  // Saved Addresses (for faster checkout)
  shippingAddress?: {
    address: string;
    city: string;
    postalCode: string;
    country: string;
  };
  
  // Seller Profile (if role = 'seller')
  seller?: ISellerProfile;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;                    // Soft delete for GDPR

  // Instance Methods
  matchPassword(password: string): Promise<boolean>;
  getFullName(): string;
  setPassword(password: string): Promise<void>;
}

const userSchema: Schema = new Schema(
  {
    // Identity
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Please provide a valid email address'
      ],
      maxlength: 255
      // unique constraint declared below as partialFilterExpression on deletedAt: null
    },

    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: [50, 'First name cannot exceed 50 characters']
    },

    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: [50, 'Last name cannot exceed 50 characters']
    },

    phone: {
      type: String,
      trim: true,
      maxlength: 20,
      sparse: true
    },

    avatar: {
      type: String,
      default: null,
      maxlength: 500
    },

    // Role & Permissions
    role: {
      type: String,
      enum: {
        values: ['buyer', 'seller', 'admin', 'super_admin', 'system'],
        message: 'Invalid role'
      },
      default: 'buyer',
      immutable: false
    },

    capabilities: {
      type: [{
        name: { type: String, required: true, index: true },
        grantedAt: { type: Date, default: Date.now },
        grantedBy: { type: String, required: true },
        reason: { type: String },
        expiresAt: { type: Date, index: true, sparse: true },
        revokedAt: { type: Date, index: true, sparse: true },
        revokedBy: { type: String },
        revokedReason: { type: String }
      }],
      default: [],
      description: 'Fine-grained permission grants with tracking'
    },

    // Email Verification
    isEmailVerified: {
      type: Boolean,
      default: false
    },

    emailVerificationToken: {
      type: String,
      select: false,
      sparse: true
    },

    emailVerifiedAt: {
      type: Date,
      sparse: true
    },

    // Password Security
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false,
      minlength: 60,  // Argon2id encoded hash length
      description: 'Argon2id hashed password (never plaintext)'
    },

    passwordChangedAt: {
      type: Date,
      sparse: true
    },

    passwordHistory: {
      type: [String],
      select: false,
      default: [],
      description: 'Last 5 password hashes (prevent reuse)'
    },

    passwordResetToken: {
      type: String,
      select: false,
      sparse: true
    },

    passwordResetExpiresAt: {
      type: Date,
      select: false,
      sparse: true
    },

    minPasswordLength: {
      type: Number,
      default: 12,
      min: 12
    },

    requiresPasswordChange: {
      type: Boolean,
      default: false
    },

    // Account Status
    status: {
      type: String,
      enum: {
        values: ['active', 'inactive', 'suspended', 'deleted'],
        message: 'Invalid account status'
      },
      default: 'active'
    },

    suspensionReason: {
      type: String,
      enum: [
        'too_many_failed_logins',
        'admin_suspension',
        'policy_violation',
        'payment_fraud',
        'content_violation',
        'user_request',
        'security_incident'
      ],
      sparse: true
    },

    suspendedAt: {
      type: Date,
      sparse: true
    },

    suspendedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      sparse: true
    },

    // 2FA
    twoFactorEnabled: {
      type: Boolean,
      default: false
    },

    twoFactorSecret: {
      type: String,
      select: false,
      sparse: true
    },

    backupCodes: {
      type: [String],
      select: false,
      default: []
    },

    // Device & Session Tracking
    trustedDevices: {
      type: [
        {
          deviceId: String,
          userAgent: String,
          ipAddress: String,
          lastUsedAt: Date,
          createdAt: Date
        }
      ],
      default: [],
      select: false
    },

    lastLoginAt: {
      type: Date,
      sparse: true
    },

    lastLoginIp: {
      type: String,
      sparse: true
    },

    // Failed Login Tracking
    failedLoginAttempts: {
      type: Number,
      default: 0,
      min: 0
    },

    lastFailedLoginAt: {
      type: Date,
      sparse: true
    },

    lastSuccessfulLoginAt: {
      type: Date,
      sparse: true
    },

    loginLockedUntil: {
      type: Date,
      sparse: true
    },

    // Fraud & Security
    suspicious: {
      type: Boolean,
      default: false
    },

    ipAddressWhitelist: {
      type: [String],
      default: [],
      select: false
    },

    ipAddressBlacklist: {
      type: [String],
      default: [],
      select: false
    },

    // Saved shipping address (optional)
    shippingAddress: {
      address: { type: String, default: '' },
      city: { type: String, default: '' },
      postalCode: { type: String, default: '' },
      country: { type: String, default: '' }
    },

    // Seller Profile
    seller: {
      businessName: String,
      businessLicense: String,
      verificationStatus: {
        type: String,
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending'
      },
      verifiedAt: Date,
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      trustScore: {
        type: Number,
        default: 50,
        min: 0,
        max: 100
      },
      commissionRate: {
        type: Number,
        default: 5,
        min: 0,
        max: 100
      },
      payoutMethod: {
        type: String,
        enum: ['bank_transfer', 'stripe', 'paypal']
      },
      payoutDetails: {
        bankName: String,
        accountNumber: String,
        routingNumber: String
      },
      totalEarnings: {
        type: Number,
        default: 0
      },
      pendingEarnings: {
        type: Number,
        default: 0
      },
      withdrawnEarnings: {
        type: Number,
        default: 0
      }
    },

    // Soft Delete
    deletedAt: {
      type: Date,
      sparse: true,
      default: null
    }
  },
  {
    timestamps: true,
    collection: 'users',
    strict: 'throw'  // Prevent unknown fields
  }
);

/**
 * INDEX STRATEGY
 * ==============
 * Indexes cover all queries for optimal performance.
 * Email unique index scoped to non-deleted users so soft-deleted accounts can re-register.
 */

// email unique only among non-deleted users (GDPR-friendly)
userSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } }
);
// role + status compound for admin user lists
userSchema.index({ role: 1, status: 1 });
// suspicious users feed
userSchema.index({ suspicious: 1, createdAt: -1 });
// seller dashboards
userSchema.index({ 'seller.verificationStatus': 1 });
userSchema.index({ 'seller.trustScore': 1 });
// recent signups
userSchema.index({ createdAt: -1 });
// soft delete marker
userSchema.index({ deletedAt: 1 }, { sparse: true });
// security: locked accounts + failed login backoff
userSchema.index({ loginLockedUntil: 1 }, { sparse: true });
userSchema.index({ lastFailedLoginAt: 1 }, { sparse: true });

/**
 * Soft delete: hide deleted users by default.
 * Override with `.setOptions({ includeDeleted: true })` for admin queries.
 */
const softDeleteFilter = function (this: any) {
  if (this.getOptions && this.getOptions().includeDeleted === true) return;
  const existing = this.getQuery().deletedAt;
  if (existing === undefined) {
    this.where({ deletedAt: null });
  }
};
userSchema.pre('find', softDeleteFilter);
userSchema.pre('findOne', softDeleteFilter);
userSchema.pre('findOneAndUpdate', softDeleteFilter);
userSchema.pre('countDocuments', softDeleteFilter);

/**
 * toJSON: strip sensitive fields even if select:false is bypassed.
 * Defense in depth for API responses.
 */
userSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: any) => {
    delete ret.passwordHash;
    delete ret.passwordHistory;
    delete ret.passwordResetToken;
    delete ret.passwordResetExpiresAt;
    delete ret.emailVerificationToken;
    delete ret.twoFactorSecret;
    delete ret.backupCodes;
    delete ret.trustedDevices;
    delete ret.ipAddressWhitelist;
    delete ret.ipAddressBlacklist;
    if (ret.seller && ret.seller.payoutDetails) {
      delete ret.seller.payoutDetails.accountNumber;
      delete ret.seller.payoutDetails.routingNumber;
    }
    return ret;
  }
});

/**
 * Instance Methods
 */

/**
 * Get user's full name
 */
userSchema.methods.getFullName = function (this: IUser): string {
  return `${this.firstName} ${this.lastName}`.trim();
};

/**
 * Match user entered password to hashed password in database
 */
userSchema.methods.matchPassword = async function (this: IUser, enteredPassword: string): Promise<boolean> {
  return await verifyPassword(enteredPassword, this.passwordHash);
};

/**
 * Set password (hash it before storing)
 */
userSchema.methods.setPassword = async function (this: IUser, password: string): Promise<void> {
  this.passwordHash = await hashPassword(password);
  this.passwordChangedAt = new Date();
};

/**
 * Check if account is locked due to failed attempts
 */
userSchema.methods.isLoginLocked = function (this: IUser): boolean {
  if (!this.loginLockedUntil) return false;
  return this.loginLockedUntil > new Date();
};

/**
 * Check if email is verified
 */
userSchema.methods.isEmailVerifiedCheck = function (this: IUser): boolean {
  return this.isEmailVerified === true;
};

/**
 * Get public profile (for seller profiles)
 */
userSchema.methods.getPublicProfile = function (this: IUser) {
  return {
    id: this._id,
    firstName: this.firstName,
    lastName: this.lastName,
    avatar: this.avatar,
    ...(this.role === 'seller' && this.seller && {
      businessName: this.seller.businessName,
      trustScore: this.seller.trustScore,
      seller: {
        businessName: this.seller.businessName,
        verificationStatus: this.seller.verificationStatus
      }
    })
  };
};

/**
 * Statics (Class Methods)
 */

/**
 * Find user by email
 */
userSchema.statics.findByEmail = function (
  this: mongoose.Model<IUser>,
  email: string
) {
  return this.findOne({ email: email.toLowerCase(), deletedAt: null });
};

/**
 * Find active users only
 */
userSchema.statics.findActive = function (
  this: mongoose.Model<IUser>
) {
  return this.find({ status: 'active', deletedAt: null });
};

/**
 * Find sellers
 */
userSchema.statics.findSellers = function (
  this: mongoose.Model<IUser>
) {
  return this.find({ role: 'seller', deletedAt: null });
};

/**
 * Find admins
 */
userSchema.statics.findAdmins = function (
  this: mongoose.Model<IUser>
) {
  return this.find({ 
    role: { $in: ['admin', 'super_admin'] },
    deletedAt: null
  });
};

/**
 * Soft delete user
 */
userSchema.statics.softDelete = function (
  this: mongoose.Model<IUser>,
  userId: mongoose.Types.ObjectId
) {
  return this.findByIdAndUpdate(
    userId,
    { deletedAt: new Date(), status: 'deleted' },
    { new: true }
  );
};

/**
 * Find all active sessions for user (query Sessions collection)
 * NOTE: Implementation in AuthService
 */

const User = mongoose.model<IUser>('User', userSchema);

export default User;