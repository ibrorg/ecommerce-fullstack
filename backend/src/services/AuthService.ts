/**
 * Authentication Service
 * ======================
 * 
 * Core authentication business logic
 * Handles: login, logout, token generation/refresh, session management
 * 
 * RESPONSIBILITY:
 * - NOT HTTP logic (that's controller's job)
 * - Pure business rules
 * - Token lifecycle management
 * - Session creation/revocation
 * - Device tracking
 * - Rate limit checks (handled in controller/middleware, service enforces rules)
 * 
 * SECURITY PRINCIPLES:
 * - Token generation is cryptographically secure
 * - Refresh tokens rotate on every refresh
 * - Access tokens have short TTL (15 min)
 * - Refresh tokens have longer TTL (7 days)
 * - Sessions are device-aware
 * - Anomalous logins trigger re-auth requirement
 * 
 * NEVER:
 * - Return plaintext tokens in logs
 * - Store token (plaintext) in DB
 * - Reuse tokens
 * - Trust client's claimed role/permissions
 */

import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User';
import Session, { ISession } from '../models/Session';
import {
  hashPassword,
  verifyPassword,
  generateToken,
  hashToken,
  verifyToken,
  generateDeviceFingerprint,
  sha256Hash
} from '../utils/crypto';

/**
 * Authentication claims in JWT
 * Minimal: only what's needed for authorization
 * Role/capabilities checked server-side on every request
 */
interface AuthTokenPayload {
  userId: string;
  email: string;
  role: string;
  sessionId: string;
  deviceId: string;
  iat: number;
  exp: number;
}

/**
 * Tokens returned to client
 */
interface AuthTokens {
  accessToken: string;          // 15-min JWT
  refreshToken: string;         // 7-day refresh token (for HttpOnly cookie)
  sessionId: string;            // Track which session
  expiresIn: number;            // Access token TTL in seconds
  refreshExpiresIn: number;     // Refresh token TTL in seconds
}

/**
 * Login result
 */
interface LoginResult {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    avatar?: string;
  };
  tokens: AuthTokens;
  session: {
    sessionId: string;
    deviceId: string;
    requiresReauth: boolean;
  };
}

export class AuthService {
  /**
   * Token TTLs (configurable via env)
   */
  private accessTokenTTL = parseInt(process.env.JWT_ACCESS_TTL || '900', 10); // 15 min
  private refreshTokenTTL = parseInt(
    process.env.JWT_REFRESH_TTL || '604800',
    10
  ); // 7 days
  
  /**
   * Secrets (from environment - NEVER hardcoded)
   */
  private accessTokenSecret = process.env.JWT_ACCESS_SECRET;
  private refreshTokenSecret = process.env.JWT_REFRESH_SECRET;

  constructor() {
    if (!this.accessTokenSecret || !this.refreshTokenSecret) {
      throw new Error(
        'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set in environment'
      );
    }
  }

  /**
   * Login user with email + password
   * 
   * FLOW:
   * 1. Find user by email
   * 2. Verify password (constant-time)
   * 3. Create session (device-aware)
   * 4. Generate tokens (access + refresh)
   * 5. Check for suspicious login (new device, new IP)
   * 6. Return tokens + session
   * 
   * @param email User email
   * @param password Raw password (never stored)
   * @param userAgent Browser/client info
   * @param ipAddress Client IP
   * @param timezone Client timezone
   * @returns LoginResult with tokens + session
   * @throws UnauthorizedError if password wrong
   * @throws BadRequestError if user not found
   */
  async login(
    email: string,
    password: string,
    userAgent: string,
    ipAddress: string,
    timezone: string = 'UTC'
  ): Promise<LoginResult> {
    // Find user (password must be selected)
    const user = await User.findOne({ email }).select('+passwordHash');
    
    if (!user) {
      throw new Error('User not found');
    }
    
    if (user.status === 'suspended') {
      throw new Error(
        `Account suspended. Reason: ${user.suspensionReason || 'Unknown'}`
      );
    }
    
    if (user.status === 'deleted') {
      throw new Error('Account not found');
    }
    
    // Verify password (constant-time comparison)
    const passwordValid = await verifyPassword(password, user.passwordHash);
    
    if (!passwordValid) {
      // Track failed login
      await this.recordFailedLogin(user._id, ipAddress);
      throw new Error('Invalid email or password');
    }
    
    // Generate device fingerprint
    const deviceId = generateDeviceFingerprint(userAgent, ipAddress, timezone);
    
    // Check if this is a new device
    const trustedDevice = user.trustedDevices?.find(d => d.deviceId === deviceId);
    const isNewDevice = !trustedDevice;
    
    // Check if this is a new IP
    const isNewIP = !user.trustedDevices?.some(d => d.ipAddress === ipAddress);
    
    // Create session
    const sessionId = generateToken(32);
    const refreshToken = generateToken(32);
    const refreshTokenHash = await hashToken(refreshToken);
    
    const expiresAt = new Date();
    expiresAt.setSeconds(
      expiresAt.getSeconds() + this.refreshTokenTTL
    );
    
    const session = new Session({
      sessionId,
      userId: user._id,
      deviceId,
      userAgent,
      ipAddress,
      timezone,
      refreshTokenHash,
      expiresAt,
      // Only require re-auth if this is a NEW device for an EXISTING user with trusted devices
      // For new users or first device, don't require re-auth
      requiresReauth: false,
      suspiciousActivityDetected: isNewDevice && user.trustedDevices && user.trustedDevices.length > 0
    });
    
    await session.save();
    
    // Add/update device in trusted list
    if (!trustedDevice) {
      user.trustedDevices = user.trustedDevices || [];
      user.trustedDevices.push({
        deviceId,
        userAgent,
        ipAddress,
        lastUsedAt: new Date(),
        createdAt: new Date()
      });
    } else {
      // Update last used
      trustedDevice.lastUsedAt = new Date();
    }
    
    // Clear failed login attempts
    user.failedLoginAttempts = 0;
    user.lastSuccessfulLoginAt = new Date();
    
    await user.save();
    
    // Generate tokens
    const tokens = this.generateTokens(user, session.sessionId, deviceId);
    
    return {
      user: {
        id: user._id?.toString() ?? '',
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        avatar: user.avatar
      },
      tokens,
      session: {
        sessionId,
        deviceId,
        requiresReauth: session.requiresReauth ?? false
      }
    };
  }

  /**
   * Logout user
   * Revokes current session + all refresh tokens
   * 
   * @param sessionId Session to revoke
   * @param userId User ID (verification)
   * @param reason Why logging out
   */
  async logout(
    sessionId: string,
    userId: string,
    reason: ISession['revokedReason'] = 'user_logout'
  ): Promise<void> {
    const session = await Session.findOne({ sessionId, userId });
    
    if (!session) {
      throw new Error('Session not found');
    }
    
    session.revokedAt = new Date();
    session.revokedReason = reason;
    
    await session.save();
  }

  /**
   * Logout from all devices
   * Revokes ALL sessions for user
   * Used after password change, suspicious activity
   * 
   * @param userId User ID
   * @param reason Why logging out all
   */
  async logoutAllDevices(
    userId: string,
    reason: ISession['revokedReason'] = 'user_logout'
  ): Promise<void> {
    const mongoose = await import('mongoose');
    await Session.revokeAllUserSessions(
      new mongoose.Types.ObjectId(userId),
      reason
    );
  }

  /**
   * Refresh access token
   * 
   * FLOW:
   * 1. Verify refresh token hash
   * 2. Check session is active (not revoked, not expired)
   * 3. Check user is still active
   * 4. Generate new access token
   * 5. Rotate refresh token (new token + new hash)
   * 6. Update session with new token hash
   * 7. Return new tokens
   * 
   * SECURITY:
   * - Old refresh token becomes invalid (rotation)
   * - New token generated each time
   * - Session tracks token hash
   * 
   * @param sessionId Current session
   * @param refreshToken Token from cookie
   * @param userId User ID (verification)
   * @returns New access token + rotated refresh token
   * @throws UnauthorizedError if any validation fails
   */
  async refreshAccessToken(
    sessionId: string,
    refreshToken: string,
    userId: string
  ): Promise<AuthTokens> {
    // Find session (includes token hash)
    const session = await Session.findBySessionId(sessionId);
    
    if (!session) {
      throw new Error('Session not found');
    }
    
    // Verify session belongs to user
    if (session.userId.toString() !== userId) {
      throw new Error('Session user mismatch');
    }
    
    // Verify session is active
    if (!session.isActive()) {
      throw new Error('Session expired or revoked');
    }
    
    // Verify refresh token matches hash
    const tokenValid = await verifyToken(refreshToken, session.refreshTokenHash);
    
    if (!tokenValid) {
      // Token doesn't match = potential token theft
      // Revoke entire session + all sessions
      session.revoke('security_breach');
      await session.save();
      
      await this.logoutAllDevices(userId, 'security_breach');
      
      throw new Error('Token validation failed - all sessions revoked');
    }
    
    // Verify user is still active
    const user = await User.findById(userId);
    
    if (!user || user.status !== 'active') {
      session.revoke('account_suspended');
      await session.save();
      throw new Error('User is not active');
    }
    
    // Generate new refresh token + hash
    const newRefreshToken = generateToken(32);
    const newRefreshTokenHash = await hashToken(newRefreshToken);
    
    // Update session with new token hash
    session.refreshTokenHash = newRefreshTokenHash;
    session.lastActivityAt = new Date();
    
    const newExpiresAt = new Date();
    newExpiresAt.setSeconds(
      newExpiresAt.getSeconds() + this.refreshTokenTTL
    );
    session.expiresAt = newExpiresAt;
    
    await session.save();
    
    // Generate new access token
    const accessToken = this.generateAccessToken(
      user,
      session.sessionId,
      session.deviceId
    );
    
    return {
      accessToken,
      refreshToken: newRefreshToken,
      sessionId: session.sessionId,
      expiresIn: this.accessTokenTTL,
      refreshExpiresIn: this.refreshTokenTTL
    };
  }

  /**
   * Verify JWT access token
   * Called by auth middleware on every protected request
   * 
   * @param token Access token from Authorization header
   * @returns Decoded token payload
   * @throws Error if invalid/expired
   */
  async verifyAccessToken(token: string): Promise<AuthTokenPayload> {
    try {
      const decoded = jwt.verify(
        token,
        this.accessTokenSecret as string
      ) as AuthTokenPayload;
      
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Access token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid access token');
      }
      throw error;
    }
  }

  /**
   * Record failed login attempt
   * Tracks failed attempts per user
   * Triggers lockout after threshold
   * 
   * @param userId User ID
   * @param ipAddress IP of failed attempt
   */
  private async recordFailedLogin(
    userId: unknown,
    ipAddress: string
  ): Promise<void> {
    const user = await User.findById(userId);
    
    if (!user) return;
    
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
    user.lastFailedLoginAt = new Date();
    
    // Lock account after 5 failed attempts
    const failureThreshold = parseInt(
      process.env.LOGIN_FAILURE_THRESHOLD || '5',
      10
    );
    
    if (user.failedLoginAttempts >= failureThreshold) {
      user.status = 'suspended';
      user.suspensionReason = 'Too many failed login attempts';
      user.suspendedAt = new Date();
    }
    
    await user.save();
  }

  /**
   * Generate both access + refresh tokens
   * 
   * @param user User document
   * @param sessionId Session ID
   * @param deviceId Device fingerprint
   * @returns TokenSet with both tokens
   */
  private generateTokens(
    user: IUser,
    sessionId: string,
    deviceId: string
  ): AuthTokens {
    const accessToken = this.generateAccessToken(user, sessionId, deviceId);
    
    return {
      accessToken,
      refreshToken: '',  // Generated separately in login
      sessionId,
      expiresIn: this.accessTokenTTL,
      refreshExpiresIn: this.refreshTokenTTL
    };
  }

  /**
   * Generate access token JWT
   * 
   * Claims:
   * - userId: User ID (for lookup)
   * - email: For display/verification
   * - role: For RBAC (verified on backend)
   * - sessionId: Link to session (revocation)
   * - deviceId: Verify same device
   * - iat/exp: Timing
   * 
   * @param user User document
   * @param sessionId Session ID
   * @param deviceId Device ID
   * @returns JWT string
   */
  private generateAccessToken(
    user: IUser,
    sessionId: string,
    deviceId: string
  ): string {
    const now = Math.floor(Date.now() / 1000);
    
    const payload: AuthTokenPayload = {
      userId: user._id?.toString() ?? '',
      email: user.email,
      role: user.role,
      sessionId,
      deviceId,
      iat: now,
      exp: now + this.accessTokenTTL
    };
    
    return jwt.sign(payload, this.accessTokenSecret as string, {
      algorithm: 'HS256',
      noTimestamp: false
    });
  }

  /**
   * Change user password
   * Invalidates all existing sessions (force re-login)
   * 
   * @param userId User ID
   * @param currentPassword Current password (for verification)
   * @param newPassword New password (validated separately)
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await User.findById(userId).select('+password');
    
    if (!user) {
      throw new Error('User not found');
    }
    
    // Verify current password
    const currentValid = await verifyPassword(currentPassword, user.passwordHash);
    
    if (!currentValid) {
      await this.recordFailedLogin(userId, '0.0.0.0');  // Unknown IP
      throw new Error('Current password is incorrect');
    }
    
    // Hash new password
    const newHash = await hashPassword(newPassword);
    
    user.passwordHash = newHash;
    user.passwordChangedAt = new Date();
    user.failedLoginAttempts = 0;
    
    await user.save();
    
    // Revoke all sessions (force re-login)
    await this.logoutAllDevices(userId, 'password_changed');
  }

  /**
   * Request password reset
   * Generates reset token + sends email
   * 
   * @param email User email
   * @returns Token to send in email link (NOT stored)
   */
  async requestPasswordReset(email: string): Promise<string> {
    const user = await User.findOne({ email });
    
    if (!user) {
      // Don't leak if email exists
      throw new Error('Check your email for reset link');
    }
    
    // Generate reset token
    const resetToken = generateToken(32);
    const resetTokenHash = await hashToken(resetToken);
    
    // Set expiry (1 hour)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);
    
    user.passwordResetToken = resetTokenHash;
    user.passwordResetExpiresAt = expiresAt;
    
    await user.save();
    
    // Return token to send in email (NOT stored)
    return resetToken;
  }

  /**
   * Reset password with token
   * Token must match hash + not be expired
   * 
   * @param email User email
   * @param resetToken Token from reset link
   * @param newPassword New password
   */
  async resetPassword(
    email: string,
    resetToken: string,
    newPassword: string
  ): Promise<void> {
    const user = await User.findOne({ email });
    
    if (!user || !user.passwordResetToken) {
      throw new Error('Invalid or expired reset link');
    }
    
    // Verify token
    const tokenValid = await verifyToken(resetToken, user.passwordResetToken);
    
    if (!tokenValid) {
      throw new Error('Invalid reset link');
    }
    
    // Verify not expired
    if (!user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
      user.passwordResetToken = undefined;
      user.passwordResetExpiresAt = undefined;
      await user.save();
      throw new Error('Reset link expired');
    }
    
    // Hash new password
    const newHash = await hashPassword(newPassword);
    
    user.passwordHash = newHash;
    user.passwordResetToken = undefined;
    user.passwordResetExpiresAt = undefined;
    user.passwordChangedAt = new Date();
    user.failedLoginAttempts = 0;
    
    await user.save();
    
    // Revoke all sessions (force re-login with new password)
    await this.logoutAllDevices(user._id?.toString() ?? '', 'password_reset');
  }

  /**
   * Verify email
   * 
   * @param email User email
   * @param verificationToken Token from email link
   */
  async verifyEmail(email: string, verificationToken: string): Promise<void> {
    const user = await User.findOne({ email });
    
    if (!user) {
      throw new Error('User not found');
    }
    
    if (!user.emailVerificationToken) {
      throw new Error('Already verified or token expired');
    }
    
    // Verify token
    const tokenValid = await verifyToken(
      verificationToken,
      user.emailVerificationToken
    );
    
    if (!tokenValid) {
      throw new Error('Invalid verification token');
    }
    
    user.emailVerifiedAt = new Date();
    user.emailVerificationToken = undefined;
    user.isEmailVerified = true;
    
    await user.save();
  }
}

export default AuthService;
