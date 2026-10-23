import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import crypto from 'crypto';
import User, { IUser } from '../models/User';
import { AuthenticatedRequest } from '../middleware/auth';
import emailService from '../services/emailService';
import { AuthService } from '../services/AuthService';
import Session from '../models/Session';

const isProduction = process.env.NODE_ENV === 'production';
const cookieSameSite = ((): 'lax' | 'strict' | 'none' => {
  const configured = (process.env.COOKIE_SAMESITE || '').toLowerCase();
  if (configured === 'lax' || configured === 'strict' || configured === 'none') return configured;
  // Default for production: allow cross-site frontends (Vercel) to receive refresh cookies.
  return isProduction ? 'none' : 'lax';
})();

const refreshCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: cookieSameSite,
  path: '/',
} as const;

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
      return;
    }

    const { name, email, password } = req.body;

    // Parse name into firstName and lastName
    // If only one name provided, use it as firstName and set lastName to a placeholder
    const nameParts = name.trim().split(' ').filter((part: string) => part.length > 0);
    const firstName = nameParts[0] || 'User';
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'User';

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      res.status(400).json({
        success: false,
        error: 'User with this email already exists'
      });
      return;
    }

    // Hash password using Argon2id
    const { hashPassword } = await import('../utils/crypto');
    const passwordHash = await hashPassword(password);

    // Create user with verification token
    const verificationToken = crypto.randomBytes(20).toString('hex');
    const user = await User.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.toLowerCase(),
      passwordHash,
      emailVerificationToken: verificationToken
    });

    // Send verification email (skipped if SMTP not configured)
    try {
      await emailService.sendVerificationEmail(user.email, user.getFullName(), verificationToken);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // in dev mode, log the token so you can still verify manually
      if (process.env.NODE_ENV === 'development') {
        console.log(`Dev only — verification token for ${email}: ${verificationToken}`);
      }
    }

    // Send welcome email
    try {
      await emailService.sendWelcomeEmail(user.email, user.getFullName());
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Don't fail the registration if email fails
    }

    // Use AuthService to create session and tokens
    const authService = new AuthService();
    const userAgent = req.get('User-Agent') || 'Unknown';
    const ipAddress = req.ip || 'unknown';
    const timezone = req.body.timezone || 'UTC';

    const loginResult = await authService.login(
      user.email,
      password,
      userAgent,
      ipAddress,
      timezone
    );
    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', loginResult.tokens.refreshToken, {
      ...refreshCookieOptions,
      maxAge: loginResult.tokens.refreshExpiresIn * 1000,
    });

    res.status(201).json({
      success: true,
      token: loginResult.tokens.accessToken,
      data: {
        id: loginResult.user.id,
        name: `${loginResult.user.firstName} ${loginResult.user.lastName}`.trim(),
        email: loginResult.user.email,
        role: loginResult.user.role,
        avatar: loginResult.user.avatar,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt
      },
      sessionId: loginResult.tokens.sessionId,
      expiresIn: loginResult.tokens.expiresIn
    });
  } catch (error) {
    console.error('Register error:', error);
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
      return;
    }

    const { email, password } = req.body;

    // Use AuthService to handle login
    const authService = new AuthService();
    const userAgent = req.get('User-Agent') || 'Unknown';
    const ipAddress = req.ip || 'unknown';
    const timezone = req.body.timezone || 'UTC';

    const loginResult = await authService.login(
      email.toLowerCase(),
      password,
      userAgent,
      ipAddress,
      timezone
    );

    // Fetch user to get additional fields not in loginResult
    const user = await User.findById(loginResult.user.id);

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', loginResult.tokens.refreshToken, {
      ...refreshCookieOptions,
      maxAge: loginResult.tokens.refreshExpiresIn * 1000,
    });

    res.status(200).json({
      success: true,
      token: loginResult.tokens.accessToken,
      data: {
        id: loginResult.user.id,
        name: `${loginResult.user.firstName} ${loginResult.user.lastName}`.trim(),
        email: loginResult.user.email,
        role: loginResult.user.role,
        avatar: loginResult.user.avatar,
        isEmailVerified: user?.isEmailVerified || false,
        createdAt: user?.createdAt
      },
      sessionId: loginResult.tokens.sessionId,
      expiresIn: loginResult.tokens.expiresIn
    });
  } catch (error) {
    console.error('Login error:', error);
    
    // Handle specific auth errors
    if (error instanceof Error) {
      const errorMessage = error.message;
      
      if (errorMessage.includes('suspended')) {
        res.status(403).json({
          success: false,
          error: errorMessage
        });
        return;
      }
      
      if (errorMessage.includes('not found') || errorMessage.includes('Invalid')) {
        res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
        return;
      }
    }
    
    next(error);
  }
};

// @desc    Logout user / clear cookie
// @route   POST /api/auth/logout
// @access  Private
export const logout = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get sessionId from request (set by auth middleware)
    const sessionId = req.sessionId;
    const userId = req.user?._id?.toString();

    if (sessionId && userId) {
      // Use AuthService to revoke session
      const authService = new AuthService();
      await authService.logout(sessionId, userId, 'user_logout');
    }

    // Clear cookies
    res.clearCookie('token');
    res.clearCookie('refreshToken', {
      ...refreshCookieOptions
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    // Even if logout fails, clear cookies
    res.clearCookie('token');
    res.clearCookie('refreshToken');
    next(error);
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await User.findById(req.user!._id).select('-passwordHash');

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        name: `${user.firstName} ${user.lastName}`.trim(),
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
        shippingAddress: user.shippingAddress
      }
    });
  } catch (error) {
    console.error('GetMe error:', error);
    next(error);
  }
};

// @desc    Update user details
// @route   PUT /api/auth/updatedetails
// @access  Private
export const updateDetails = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const fieldsToUpdate: Record<string, unknown> = {};

    if (typeof req.body.email === 'string') {
      fieldsToUpdate.email = req.body.email.toLowerCase().trim();
    }

    if (typeof req.body.name === 'string') {
      const nameParts = req.body.name.trim().split(' ').filter((p: string) => p.length > 0);
      const firstName = nameParts[0] || 'User';
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'User';
      fieldsToUpdate.firstName = firstName.trim();
      fieldsToUpdate.lastName = lastName.trim();
    }

    const user = await User.findByIdAndUpdate(req.user!._id, fieldsToUpdate, {
      new: true,
      runValidators: true
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        name: `${user.firstName} ${user.lastName}`.trim(),
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
        shippingAddress: user.shippingAddress
      }
    });
  } catch (error) {
    console.error('Update details error:', error);
    next(error);
  }
};

// @desc    Update password
// @route   PUT /api/auth/updatepassword
// @access  Private
export const updatePassword = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await User.findById(req.user!._id).select('+passwordHash');

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    // Check current password
    if (!(await user.matchPassword(req.body.currentPassword))) {
      res.status(401).json({
        success: false,
        error: 'Current password is incorrect'
      });
      return;
    }

    await user.setPassword(req.body.newPassword);
    await user.save();

    // Use AuthService to create new session after password change
    const authService = new AuthService();
    const userAgent = req.get('User-Agent') || 'Unknown';
    const ipAddress = req.ip || 'unknown';
    const timezone = req.body.timezone || 'UTC';

    const loginResult = await authService.login(
      user.email,
      req.body.newPassword,
      userAgent,
      ipAddress,
      timezone
    );

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', loginResult.tokens.refreshToken, {
      ...refreshCookieOptions,
      maxAge: loginResult.tokens.refreshExpiresIn * 1000,
    });

    res.status(200).json({
      success: true,
      token: loginResult.tokens.accessToken,
      data: {
        id: loginResult.user.id,
        name: `${loginResult.user.firstName} ${loginResult.user.lastName}`.trim(),
        email: loginResult.user.email,
        role: loginResult.user.role,
        avatar: loginResult.user.avatar,
        isEmailVerified: user.isEmailVerified
      },
      sessionId: loginResult.tokens.sessionId,
      expiresIn: loginResult.tokens.expiresIn
    });
  } catch (error) {
    console.error('Update password error:', error);
    next(error);
  }
};

// @desc    Verify email
// @route   GET /api/auth/verify/:token
// @access  Public
export const verifyEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { token } = req.params;

    const user = await User.findOne({
      emailVerificationToken: token
    });

    if (!user) {
      res.status(400).json({
        success: false,
        error: 'Invalid verification token'
      });
      return;
    }

    // Update user
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    console.error('Verify email error:', error);
    next(error);
  }
};

// @desc    Refresh access token
// @route   POST /api/auth/refresh
// @access  Public (but requires valid refresh token in cookie)
export const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get refresh token from cookie
    const refreshToken = req.cookies.refreshToken;
    
    if (!refreshToken) {
      res.status(401).json({
        success: false,
        error: 'Refresh token not found'
      });
      return;
    }

    // Get sessionId from body or try to extract from old token
    const { sessionId, userId } = req.body;
    
    if (!sessionId || !userId) {
      res.status(400).json({
        success: false,
        error: 'Session ID and User ID required'
      });
      return;
    }

    // Use AuthService to refresh token
    const authService = new AuthService();
    const tokens = await authService.refreshAccessToken(
      sessionId,
      refreshToken,
      userId
    );

    // Set new refresh token as httpOnly cookie
    res.cookie('refreshToken', tokens.refreshToken, {
      ...refreshCookieOptions,
      maxAge: tokens.refreshExpiresIn * 1000,
    });

    res.status(200).json({
      success: true,
      token: tokens.accessToken,
      sessionId: tokens.sessionId,
      expiresIn: tokens.expiresIn
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('Session') || error.message.includes('Token')) {
        res.status(401).json({
          success: false,
          error: error.message
        });
        return;
      }
    }
    
    next(error);
  }
};

// @desc    Logout from all devices
// @route   POST /api/auth/logout-all
// @access  Private
export const logoutAll = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?._id?.toString();

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
      return;
    }

    // Use AuthService to revoke all sessions
    const authService = new AuthService();
    await authService.logoutAllDevices(userId, 'user_logout');

    // Clear cookies
    res.clearCookie('token');
    res.clearCookie('refreshToken', {
      ...refreshCookieOptions
    });

    res.status(200).json({
      success: true,
      message: 'Logged out from all devices successfully'
    });
  } catch (error) {
    console.error('Logout all error:', error);
    next(error);
  }
};

// @desc    Get all active sessions
// @route   GET /api/auth/sessions
// @access  Private
export const getSessions = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?._id?.toString();

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
      return;
    }

    const mongoose = await import('mongoose');
    const sessions = await Session.findActiveSessions(
      new mongoose.Types.ObjectId(userId)
    );

    res.status(200).json({
      success: true,
      data: sessions.map(session => ({
        sessionId: session.sessionId,
        deviceId: session.deviceId,
        userAgent: session.userAgent,
        ipAddress: session.ipAddress,
        createdAt: session.createdAt,
        lastActivityAt: session.lastActivityAt,
        isCurrent: session.sessionId === req.sessionId
      }))
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    next(error);
  }
};

// @desc    Revoke a specific session
// @route   DELETE /api/auth/sessions/:sessionId
// @access  Private
export const revokeSession = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?._id?.toString();
    const { sessionId } = req.params;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
      return;
    }

    if (!sessionId) {
      res.status(400).json({
        success: false,
        error: 'Session ID required'
      });
      return;
    }

    // Use AuthService to revoke specific session
    const authService = new AuthService();
    await authService.logout(sessionId, userId, 'user_logout');

    res.status(200).json({
      success: true,
      message: 'Session revoked successfully'
    });
  } catch (error) {
    console.error('Revoke session error:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({
        success: false,
        error: 'Session not found'
      });
      return;
    }

    next(error);
  }
};

// @desc    Forgot password — generate reset token and email it
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ success: false, error: 'Email is required' });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordResetToken +passwordResetExpiresAt');

    // always return 200 even if user not found — prevents email enumeration
    if (!user) {
      res.status(200).json({ success: true, message: 'If that email exists, a reset link has been sent' });
      return;
    }

    // generate reset token (random hex) and hash it before storing
    const { hashPassword } = await import('../utils/crypto');
    const resetToken = crypto.randomBytes(20).toString('hex');
    user.passwordResetToken = resetToken;
    user.passwordResetExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    // email the reset link (skipped if SMTP not configured)
    try {
      await emailService.sendPasswordResetEmail(user.email, user.getFullName(), resetToken);
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
      if (process.env.NODE_ENV === 'development') {
        console.log(`Dev only — reset token for ${email}: ${resetToken}`);
      }
    }

    res.status(200).json({ success: true, message: 'If that email exists, a reset link has been sent' });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset password — verify token and set new password
// @route   POST /api/auth/reset-password/:token
// @access  Public
export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
      return;
    }

    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpiresAt: { $gt: new Date() }
    }).select('+passwordResetToken +passwordResetExpiresAt +passwordHash');

    if (!user) {
      res.status(400).json({ success: false, error: 'Invalid or expired reset token' });
      return;
    }

    // set new password (hashes via argon2id)
    await user.setPassword(password);
    user.passwordResetToken = undefined;
    user.passwordResetExpiresAt = undefined;
    user.requiresPasswordChange = false;
    await user.save();

    // revoke all sessions — force re-login on all devices
    try {
      const Session = (await import('../models/Session')).default;
      await Session.updateMany({ userId: user._id, isActive: true }, { $set: { isActive: false, revokedAt: new Date(), revokedReason: 'password_reset' } });
    } catch (sessionErr) {
      console.error('Failed to revoke sessions after password reset:', sessionErr);
    }

    // email confirmation
    try {
      await emailService.sendPasswordResetSuccessEmail(user.email, user.getFullName());
    } catch (emailError) {
      console.error('Failed to send reset success email:', emailError);
    }

    res.status(200).json({ success: true, message: 'Password reset successful. Please log in.' });
  } catch (error) {
    next(error);
  }
};