/**
 * Session Schema
 * ==============
 * 
 * Represents a user login session/instance
 * Each login (device) gets ONE session
 * Multiple devices = Multiple sessions for same user
 * 
 * WHY SESSIONS:
 * - Revoke specific login (not all sessions)
 * - Device-aware security (new device = new session)
 * - Detect suspicious activity (login from new country)
 * - Enforce re-auth on password change (revoke old sessions)
 * - Support "logout all devices" (revoke all sessions for user)
 * 
 * DATA FLOW:
 * 1. User logs in
 * 2. System creates Session + generates tokens
 * 3. Refresh token hash stored in session (not plaintext token)
 * 4. Session ID sent to client (for tracking)
 * 5. Refresh token sent in HttpOnly cookie (never JS access)
 * 6. On token refresh: validate session still active, rotate token
 * 7. On logout: revoke session (sets revokedAt)
 * 8. On suspicious login: require re-auth (session remains but flagged)
 * 
 * SECURITY NOTES:
 * - Refresh token HASH only stored (never plaintext)
 * - Token itself sent to client, hash stays in DB
 * - On each refresh, new token generated + hash updated
 * - Old token becomes useless (rotation)
 * - Session TTL = refresh token TTL (7 days typical)
 */

import mongoose, { Document, Schema, Model, Query } from 'mongoose';

export interface ISession extends Document {
  // Identifiers
  sessionId: string;                    // Unique per login
  userId: mongoose.Types.ObjectId;     // User who owns session
  
  // Device & Environment
  deviceId: string;                     // Device fingerprint (SHA256)
  userAgent: string;                    // Browser/client info
  ipAddress: string;                    // Where logged in from
  timezone?: string;                    // Client timezone
  
  // Token Material
  refreshTokenHash: string;             // Bcrypt hash of refresh token
  
  // Lifecycle
  createdAt: Date;                      // When session started
  lastActivityAt: Date;                 // Last request with this session
  expiresAt: Date;                      // When session dies (7 days)
  
  // Revocation
  revokedAt?: Date;                     // When admin/user revoked it
  revokedReason?: string;               // Why it was revoked
  
  // Security Flags
  requiresReauth?: boolean;             // Force user to re-enter password
  suspiciousActivityDetected?: boolean; // Unusual login pattern
  ipAddressChanged?: boolean;           // IP different from creation

  // Instance methods
  isActive(): boolean;
  isExpired(): boolean;
  revoke(reason: ISession['revokedReason']): void;
  updateLastActivity(): Promise<void>;
}

// Interface for static methods on Session model
export interface ISessionModel extends Model<ISession> {
  findActiveSessions(userId: mongoose.Types.ObjectId): Query<ISession[], ISession>;
  findBySessionId(sessionId: string): Query<ISession | null, ISession>;
  revokeAllUserSessions(userId: mongoose.Types.ObjectId, reason: ISession['revokedReason']): Promise<any>;
  deleteExpiredSessions(): Promise<any>;
}

const sessionSchema: Schema = new Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      immutable: true,
      description: 'Unique session identifier'
    },
    
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
      immutable: true,
      description: 'User who owns this session'
    },
    
    deviceId: {
      type: String,
      required: true,
      index: true,
      immutable: true,
      description: 'Device fingerprint (derived from user agent + IP + timezone)'
    },
    
    userAgent: {
      type: String,
      required: true,
      immutable: true,
      maxlength: 500,
      description: 'Client user agent string'
    },
    
    ipAddress: {
      type: String,
      required: true,
      index: true,
      immutable: true,
      description: 'IPv4 or IPv6 of login'
    },
    
    timezone: {
      type: String,
      default: 'UTC',
      maxlength: 50,
      description: 'Client timezone (e.g., America/New_York)'
    },
    
    refreshTokenHash: {
      type: String,
      required: true,
      select: false,  // Don't return in queries by default
      description: 'Bcrypt hash of refresh token (never store plaintext)'
    },
    
    createdAt: {
      type: Date,
      default: () => new Date(),
      immutable: true,
      index: true,
      description: 'When session was created'
    },
    
    lastActivityAt: {
      type: Date,
      default: () => new Date(),
      index: true,
      description: 'Last time this session made a request'
    },
    
    expiresAt: {
      type: Date,
      required: true,
      index: true,
      description: 'When session expires (7 days from creation)'
    },
    
    revokedAt: {
      type: Date,
      default: null,
      index: true,
      sparse: true,
      description: 'When session was revoked (null = active)'
    },
    
    revokedReason: {
      type: String,
      enum: [
        'user_logout',
        'password_changed',
        'account_suspended',
        'security_breach',
        'manual_admin_revocation',
        'suspicious_activity',
        'device_mismatch',
        'ip_change_detected',
        'session_expired'
      ],
      default: null,
      description: 'Why this session was revoked'
    },
    
    requiresReauth: {
      type: Boolean,
      default: false,
      description: 'Force user to re-enter password (security measure)'
    },
    
    suspiciousActivityDetected: {
      type: Boolean,
      default: false,
      index: true,
      description: 'Unusual login pattern detected'
    },
    
    ipAddressChanged: {
      type: Boolean,
      default: false,
      description: 'IP changed during session (potential compromise)'
    }
  },
  {
    timestamps: false,  // We manage timestamps manually
    collection: 'sessions'
  }
);

/**
 * INDEX STRATEGY
 * ==============
 * 
 * All queries MUST be covered by these indexes:
 * 
 * 1. sessionId (unique) - Find session by ID
 * 2. userId + expiresAt - Find active sessions for user
 * 3. userId + revokedAt - Find revoked sessions (audit)
 * 4. deviceId + userId - Find device logins for user
 * 5. expiresAt - Cleanup expired sessions
 * 6. ipAddress - Track logins from IP
 * 7. revokedAt - Find revoked sessions (maintenance)
 */

// Unique session ID
sessionSchema.index({ sessionId: 1 }, { unique: true });

// Find all active sessions for user
sessionSchema.index({ userId: 1, expiresAt: 1, revokedAt: 1 });

// Find sessions by device
sessionSchema.index({ userId: 1, deviceId: 1 });

// Cleanup old sessions
sessionSchema.index({ expiresAt: 1 });

// Find revoked sessions
sessionSchema.index({ revokedAt: 1 }, { sparse: true });

// IP-based queries
sessionSchema.index({ ipAddress: 1, createdAt: 1 });

// Compound for security queries
sessionSchema.index({ suspiciousActivityDetected: 1, createdAt: 1 });

/**
 * Instance Methods
 */

/**
 * Check if session is still active
 * @returns boolean True if not revoked and not expired
 */
sessionSchema.methods.isActive = function (this: ISession): boolean {
  return (
    !this.revokedAt &&
    this.expiresAt > new Date()
  );
};

/**
 * Check if session is expired
 * @returns boolean True if current time > expiresAt
 */
sessionSchema.methods.isExpired = function (this: ISession): boolean {
  return new Date() > this.expiresAt;
};

/**
 * Revoke this session
 * @param reason Why it was revoked
 */
sessionSchema.methods.revoke = function (
  this: ISession,
  reason: ISession['revokedReason']
): void {
  this.revokedAt = new Date();
  this.revokedReason = reason;
};

/**
 * Update last activity timestamp
 * Called on every request to track "last active"
 */
sessionSchema.methods.updateLastActivity = async function (
  this: ISession
): Promise<void> {
  this.lastActivityAt = new Date();
  await this.save();
};

/**
 * Statics (Class Methods)
 */

/**
 * Find all ACTIVE sessions for a user
 * @param userId User ID
 * @returns All non-revoked, non-expired sessions
 */
sessionSchema.statics.findActiveSessions = function (
  this: mongoose.Model<ISession>,
  userId: mongoose.Types.ObjectId
) {
  return this.find({
    userId,
    revokedAt: null,
    expiresAt: { $gt: new Date() }
  }).select('-refreshTokenHash');  // Don't return token hash
};

/**
 * Find a session by session ID
 * Includes refreshTokenHash for verification
 * @param sessionId Session ID
 * @returns Session with token hash (for internal verification)
 */
sessionSchema.statics.findBySessionId = function (
  this: mongoose.Model<ISession>,
  sessionId: string
) {
  return this.findOne({ sessionId }).select('+refreshTokenHash');
};

/**
 * Revoke all sessions for a user
 * Used on: password change, account suspension, logout all devices
 * @param userId User ID
 * @param reason Revocation reason
 */
sessionSchema.statics.revokeAllUserSessions = function (
  this: mongoose.Model<ISession>,
  userId: mongoose.Types.ObjectId,
  reason: ISession['revokedReason']
) {
  return this.updateMany(
    { userId, revokedAt: null },
    {
      revokedAt: new Date(),
      revokedReason: reason
    }
  );
};

/**
 * Delete expired sessions
 * Run periodically (daily via cron)
 * Keeps database clean
 */
sessionSchema.statics.deleteExpiredSessions = function (
  this: mongoose.Model<ISession>
) {
  return this.deleteMany({
    expiresAt: { $lt: new Date() },
    revokedAt: { $ne: null }
  });
};

/**
 * TTL Index for MongoDB automatic deletion
 * Deletes sessions 24 hours after expiry
 * Serves as backup cleanup if statics not called
 */
sessionSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 86400 }  // 24 hours after expiry
);

const Session = mongoose.model<ISession, ISessionModel>('Session', sessionSchema);

export default Session;
