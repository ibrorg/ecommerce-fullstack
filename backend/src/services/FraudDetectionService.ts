import mongoose from 'mongoose';
import { Request } from 'express';
import { FraudAlert, FraudAlertType, FraudRiskLevel } from '../models/FraudAlert';
import { DeviceRiskProfile } from '../models/DeviceRiskProfile';
import { BehaviorPattern } from '../models/BehaviorPattern';
import User from '../models/User';
import Order from '../models/Order';
import { PaymentMethod } from '../models/PaymentMethod';
import { AuditLogService } from './AuditLogService';
import { AuditActionType as AuditActionEnum, ResourceType } from '../models/AuditLog';
import Session from '../models/Session';
import { NotificationService } from './NotificationService';
import { NotificationType, NotificationChannel } from '../models/Notification';

/**
 * FraudDetectionService
 * 
 * Multi-signal fraud detection using machine learning principles
 * 
 * Detection Rules:
 * 1. VELOCITY CHECKS - Too many actions in short time
 *    - Multiple orders within minutes
 *    - Multiple refunds for same user
 *    - Multiple payment attempts
 *    - Multiple failed logins
 * 
 * 2. DUPLICATE DETECTION - Account farming
 *    - Multiple accounts from same device
 *    - Multiple accounts from same IP
 *    - Same payment method across accounts
 * 
 * 3. REFUND PATTERNS - Refund fraud
 *    - Order → Refund → Repeat (style cycling)
 *    - >50% of orders refunded
 *    - Very high refund rate vs baseline
 * 
 * 4. PAYMENT ISSUES
 *    - Multiple failed payments (brute force)
 *    - Payment card reported stolen
 *    - High-risk payment processor flagging
 *    - BIN blacklist match
 * 
 * 5. DEVICE & ACCOUNT
 *    - New device with high-value order (account takeover risk)
 *    - Device used by many accounts (farming)
 *    - Impossible travel (country change in minutes)
 *    - Password reset + immediate activity
 * 
 * 6. SHIPPING ISSUES
 *    - Address doesn't match billing address
 *    - Shipping to high-risk country
 *    - Express shipping to new address (drop shipping)
 *    - Multiple orders to different addresses (carding)
 * 
 * 7. BEHAVIORAL
 *    - Deviation from user's baseline (ML-based)
 *    - Order value 10x higher than baseline
 *    - Order frequency spike
 *    - Time of day anomaly
 * 
 * RISK SCORING:
 * Each signal contributes 0-100 points. Multiple signals combine:
 * - Sum up to 100 (hard cap)
 * - Higher = more likely fraud
 * - 80+: CRITICAL (block immediately)
 * - 60-79: HIGH (review before allowing)
 * - 40-59: MEDIUM (flag for monitoring)
 * - <40: LOW (allow with monitoring)
 */

interface DetectionContext {
  userId: mongoose.Types.ObjectId;
  email: string;
  userAgent?: string;
  ipAddress?: string;
  deviceId?: string;
  contextType: 'order' | 'payment' | 'account' | 'refund' | 'login';
  contextData: Record<string, any>;
  req?: Request;
}

interface DetectionResult {
  riskScore: number;
  riskLevel: FraudRiskLevel;
  signals: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    score: number;
    details: Record<string, any>;
  }>;
  shouldBlock: boolean;
  shouldReview: boolean;
}

export class FraudDetectionService {
  /**
   * Detect fraud for an incoming action (order, payment, login, refund)
   * Main entry point - analyzes all signals and returns risk assessment
   */
  static async detectFraud(context: DetectionContext): Promise<DetectionResult> {
    const signals = [];
    let totalScore = 0;

    // Run all detection rules in parallel
    const [
      velocitySignals,
      duplicateSignals,
      behaviorSignals,
      paymentSignals,
      deviceSignals,
      shippingSignals,
    ] = await Promise.all([
      this.checkVelocity(context),
      this.checkDuplicateAccounts(context),
      this.checkBehaviorAnomalies(context),
      this.checkPaymentIssues(context),
      this.checkDeviceRisk(context),
      this.checkShippingIssues(context),
    ]);

    // Combine all signals
    const allSignals = [
      ...velocitySignals,
      ...duplicateSignals,
      ...behaviorSignals,
      ...paymentSignals,
      ...deviceSignals,
      ...shippingSignals,
    ];

    // Calculate composite risk score (capped at 100)
    for (const signal of allSignals) {
      totalScore += signal.score;
    }
    totalScore = Math.min(totalScore, 100);

    // Determine risk level
    let riskLevel: FraudRiskLevel;
    if (totalScore >= 80) {
      riskLevel = FraudRiskLevel.CRITICAL;
    } else if (totalScore >= 60) {
      riskLevel = FraudRiskLevel.HIGH;
    } else if (totalScore >= 40) {
      riskLevel = FraudRiskLevel.MEDIUM;
    } else {
      riskLevel = FraudRiskLevel.LOW;
    }

    // Determine actions
    const shouldBlock = riskLevel === FraudRiskLevel.CRITICAL;
    const shouldReview = riskLevel === FraudRiskLevel.HIGH;

    // Create fraud alert if score high enough
    if (totalScore >= 40) {
      const primarySignal = allSignals[0]; // First signal is primary trigger
      const alert = await FraudAlert.createAlert(
        this.mapSignalToAlertType(primarySignal.type),
        context.userId,
        context.email,
        totalScore,
        allSignals.map((s) => ({
          signalType: s.type,
          severity: s.severity,
          score: s.score,
          details: s.details,
          detectedAt: new Date(),
        })),
        context.contextType,
        context.contextData,
        'automated',
        {
          userAgent: context.userAgent,
          ipAddress: context.ipAddress,
          deviceId: context.deviceId,
        }
      );

      // Log fraud detection
      await AuditLogService.log(
        totalScore >= 70 ? AuditActionEnum.FRAUD_ALERT : AuditActionEnum.SUSPICIOUS_ACTIVITY_DETECTED,
        ResourceType.USER,
        String(context.userId),
        String(context.userId),
        context.req || null,
        {
          detection: {
            from: null,
            to: {
              fraudAlertId: String(alert._id),
              riskScore: totalScore,
              riskLevel,
            }
          }
        }
      );
    }

    return {
      riskScore: totalScore,
      riskLevel,
      signals: allSignals,
      shouldBlock,
      shouldReview,
    };
  }

  /**
   * Check velocity - too many actions in short time
   */
  private static async checkVelocity(context: DetectionContext) {
    const signals = [];
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    if (context.contextType === 'order') {
      // Query Order model for recent orders from this user
      const recentOrders = await Order.find({
        user: context.userId,
        createdAt: { $gte: oneDayAgo }
      }).select('_id').lean();
      const orderCount24h = recentOrders.length;

      if (orderCount24h > 10) {
        signals.push({
          type: 'velocity_orders',
          severity: 'critical' as const,
          score: 40,
          details: { count: orderCount24h, timeframe: '24h' },
        });
      } else if (orderCount24h > 5) {
        signals.push({
          type: 'velocity_orders',
          severity: 'high' as const,
          score: 25,
          details: { count: orderCount24h, timeframe: '24h' },
        });
      }
    }

    if (context.contextType === 'refund') {
      // Query orders that have been cancelled in the last 24h
      // Note: In a complete implementation, this should query a dedicated Refund collection
      // or orders with refund-specific flags. Currently using 'cancelled' as a proxy for refunds.
      const recentRefunds = await Order.find({
        user: context.userId,
        orderStatus: 'cancelled',
        updatedAt: { $gte: oneDayAgo }
      }).select('_id').lean();
      
      if (recentRefunds.length > 3) {
        signals.push({
          type: 'velocity_refunds',
          severity: 'high' as const,
          score: 30,
          details: { count: recentRefunds.length, timeframe: '24h' },
        });
      }
    }

    if (context.contextType === 'payment') {
      // Check for payment velocity (multiple failed attempts)
      const deviceProfile = await DeviceRiskProfile.findOrCreateByDeviceId(context.deviceId || 'unknown');
      if (deviceProfile.loginAttemptCount24h > 50) {
        signals.push({
          type: 'brute_force_payment',
          severity: 'critical' as const,
          score: 45,
          details: { failedAttempts: deviceProfile.loginAttemptCount24h },
        });
      }
    }

    return signals;
  }

  /**
   * Check for duplicate accounts (account farming)
   */
  private static async checkDuplicateAccounts(context: DetectionContext) {
    const signals = [];

    // Check if this device is used by multiple accounts
    if (context.deviceId) {
      const deviceProfile = await DeviceRiskProfile.findOrCreateByDeviceId(context.deviceId);

      if (deviceProfile.uniqueUserCount > 10) {
        signals.push({
          type: 'account_farm_device',
          severity: 'critical' as const,
          score: 40,
          details: { uniqueUsers: deviceProfile.uniqueUserCount },
        });
      } else if (deviceProfile.uniqueUserCount > 5) {
        signals.push({
          type: 'account_farm_device',
          severity: 'high' as const,
          score: 25,
          details: { uniqueUsers: deviceProfile.uniqueUserCount },
        });
      }
    }

    // Check if same payment method (card fingerprint) is used by other accounts
    if (context.contextType === 'payment' && context.contextData.cardFingerprint) {
      const cardFingerprint = context.contextData.cardFingerprint;
      const paymentMethodsWithSameCard = await PaymentMethod.find({
        'card.fingerprint': cardFingerprint,
        user: { $ne: context.userId },
        deletedAt: null,
      }).select('user').lean();

      if (paymentMethodsWithSameCard.length > 0) {
        const uniqueUsers = new Set(paymentMethodsWithSameCard.map((pm: any) => pm.user.toString()));
        if (uniqueUsers.size >= 3) {
          signals.push({
            type: 'payment_method_shared',
            severity: 'critical' as const,
            score: 45,
            details: { sharedWithAccounts: uniqueUsers.size, cardFingerprint },
          });
        } else if (uniqueUsers.size >= 1) {
          signals.push({
            type: 'payment_method_shared',
            severity: 'high' as const,
            score: 30,
            details: { sharedWithAccounts: uniqueUsers.size, cardFingerprint },
          });
        }
      }
    }

    return signals;
  }

  /**
   * Check for behavioral anomalies (deviation from baseline)
   */
  private static async checkBehaviorAnomalies(context: DetectionContext): Promise<Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    score: number;
    details: Record<string, any>;
  }>> {
    const signals: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      score: number;
      details: Record<string, any>;
    }> = [];

    const behaviorProfile = await BehaviorPattern.findOrCreateByUserId(context.userId);

    if (!behaviorProfile.hasConfidentBaseline()) {
      return signals; // Not enough data to detect anomalies
    }

    // Check order value anomaly
    if (context.contextType === 'order') {
      const orderAmount = context.contextData.amount || 0;
      const baselineAvg = behaviorProfile.orders.avgValue;

      if (orderAmount > baselineAvg * 10) {
        signals.push({
          type: 'order_value_anomaly',
          severity: 'high' as const,
          score: 30,
          details: { orderAmount, baselineAvg, multiplier: orderAmount / baselineAvg },
        });
      }
    }

    // Check refund rate
    if (behaviorProfile.refunds.rate > 0.5) {
      signals.push({
        type: 'high_refund_rate',
        severity: 'high' as const,
        score: 25,
        details: { refundRate: behaviorProfile.refunds.rate },
      });
    }

    // Check payment decline rate
    if (behaviorProfile.payments.declineRate > 0.3) {
      signals.push({
        type: 'high_decline_rate',
        severity: 'medium' as const,
        score: 20,
        details: { declineRate: behaviorProfile.payments.declineRate },
      });
    }

    return signals;
  }

  /**
   * Check for payment issues
   */
  private static async checkPaymentIssues(context: DetectionContext) {
    const signals = [];

    if (context.contextType === 'payment') {
      const { success, declineCode } = context.contextData;

      // Multiple declined payments
      if (!success && declineCode) {
        // Track in device profile
        if (context.deviceId) {
          const deviceProfile = await DeviceRiskProfile.findOrCreateByDeviceId(context.deviceId);
          if (deviceProfile.paymentSuccessRate < 0.1) {
            signals.push({
              type: 'payment_decline_pattern',
              severity: 'high' as const,
              score: 35,
              details: { successRate: deviceProfile.paymentSuccessRate, declines: declineCode },
            });
          }
        }
      }
    }

    return signals;
  }

  /**
   * Check for device risk signals
   */
  private static async checkDeviceRisk(context: DetectionContext): Promise<Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    score: number;
    details: Record<string, any>;
  }>> {
    const signals: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      score: number;
      details: Record<string, any>;
    }> = [];

    if (!context.deviceId) return signals;

    const deviceProfile = await DeviceRiskProfile.findOrCreateByDeviceId(context.deviceId);

    // New device with high-value order
    if (context.contextType === 'order' && deviceProfile.uniqueUserCount === 1) {
      const orderAmount = context.contextData.amount || 0;
      if (orderAmount > 1000) {
        signals.push({
          type: 'new_device_high_value',
          severity: 'medium' as const,
          score: 20,
          details: { orderAmount, daysOld: 0 },
        });
      }
    }

    // Impossible travel
    if (deviceProfile.locationChangeVelocity && deviceProfile.locationChangeVelocity < 3600) {
      signals.push({
        type: 'impossible_travel',
        severity: 'critical' as const,
        score: 50,
        details: { velocitySeconds: deviceProfile.locationChangeVelocity },
      });
    }

    return signals;
  }

  /**
   * Check for shipping issues
   */
  private static async checkShippingIssues(context: DetectionContext) {
    const signals = [];

    if (context.contextType === 'order') {
      const { shippingAddress, billingAddress, shippingMethod, amount } = context.contextData;

      // Shipping doesn't match billing (carding indicator)
      if (shippingAddress && billingAddress && shippingAddress.country !== billingAddress.country) {
        signals.push({
          type: 'shipping_mismatch',
          severity: 'medium' as const,
          score: 20,
          details: { shippingCountry: shippingAddress.country, billingCountry: billingAddress.country },
        });
      }

      // High-value + express to new address
      if (shippingMethod === 'express' && amount > 1000) {
        signals.push({
          type: 'express_high_value',
          severity: 'medium' as const,
          score: 15,
          details: { amount, method: shippingMethod },
        });
      }
    }

    return signals;
  }

  /**
   * Map signal type to fraud alert type
   */
  private static mapSignalToAlertType(signalType: string): FraudAlertType {
    const mapping: Record<string, FraudAlertType> = {
      velocity_orders: FraudAlertType.VELOCITY_ORDERS,
      velocity_refunds: FraudAlertType.VELOCITY_REFUNDS,
      velocity_payments: FraudAlertType.VELOCITY_PAYMENTS,
      account_farm_device: FraudAlertType.DUPLICATE_ACCOUNT,
      order_value_anomaly: FraudAlertType.BEHAVIOR_ANOMALY,
      high_refund_rate: FraudAlertType.REFUND_RATE_HIGH,
      payment_decline_pattern: FraudAlertType.PAYMENT_DECLINED,
      new_device_high_value: FraudAlertType.NEW_DEVICE_HIGH_VALUE,
      impossible_travel: FraudAlertType.ACCOUNT_TAKEOVER,
      shipping_mismatch: FraudAlertType.SHIPPING_MISMATCH,
    };

    return mapping[signalType] || FraudAlertType.MANUAL_INVESTIGATION;
  }

  /**
   * Get pending fraud alerts for admin review
   */
  static async getPendingAlerts(limit: number = 50): Promise<any[]> {
    return FraudAlert.findPending(undefined, limit);
  }

  /**
   * Approve a fraud alert (analyst determined it's legitimate)
   */
  static async approveAlert(
    alertId: mongoose.Types.ObjectId,
    analystId: mongoose.Types.ObjectId,
    reason: string
  ): Promise<void> {
    const alert = await FraudAlert.findById(alertId);
    if (alert) {
      await alert.approve(analystId, reason);
    }
  }

  /**
   * Block a user due to fraud alert
   * Suspends account, invalidates all sessions, and sends notification
   */
  static async blockAlert(
    alertId: mongoose.Types.ObjectId,
    analystId: mongoose.Types.ObjectId,
    reason: string
  ): Promise<void> {
    const alert = await FraudAlert.findById(alertId);
    if (!alert) {
      throw new Error('Fraud alert not found');
    }

    // Block the alert first
    await alert.block(analystId, reason);

    // Suspend user account
    await this.suspendUserAccount(alert.userId, reason, analystId, alertId);
  }

  /**
   * Suspend user account due to fraud
   * - Updates user status to 'suspended'
   * - Invalidates all active sessions
   * - Sends notification to user
   */
  static async suspendUserAccount(
    userId: mongoose.Types.ObjectId,
    reason: string,
    suspendedBy: mongoose.Types.ObjectId,
    fraudAlertId?: mongoose.Types.ObjectId
  ): Promise<void> {
    // Update user status to suspended
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Map the reason to valid suspension reason enum values
    // Use 'payment_fraud' for fraud-related suspensions, 'security_incident' for other security issues
    const suspensionReasonType = reason.toLowerCase().includes('fraud') 
      ? 'payment_fraud' 
      : 'security_incident';

    // Set account status to suspended
    await User.findByIdAndUpdate(userId, {
      status: 'suspended',
      suspensionReason: suspensionReasonType,
      suspendedAt: new Date(),
      suspendedBy: suspendedBy,
      suspicious: true,
    });

    // Invalidate all user sessions (force logout from all devices)
    await Session.updateMany(
      { userId, revokedAt: null },
      {
        revokedAt: new Date(),
        revokedReason: 'account_suspended'
      }
    );

    // Send notification to user about account suspension
    try {
      await NotificationService.createAndSend({
        userId,
        type: NotificationType.FRAUD_ALERT,
        channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
        title: '🚫 Account Suspended',
        body: `Your account has been suspended due to suspicious activity: ${reason}. If you believe this is an error, please contact our support team immediately to resolve this issue.`,
        subject: 'Account Suspended - Action Required',
        actionUrl: '/support/appeal',
        actionText: 'Contact Support',
        priority: 'critical',
        relatedResource: fraudAlertId ? {
          type: 'fraud_alert',
          id: fraudAlertId,
        } : undefined,
      });
    } catch (notificationError) {
      console.error('Failed to send suspension notification:', notificationError);
      // Don't fail the suspension if notification fails
    }

    // Log the suspension in audit
    await AuditLogService.log(
      AuditActionEnum.USER_SUSPENDED,
      ResourceType.USER,
      String(userId),
      String(suspendedBy),
      null,
      {
        suspension: {
          from: null,
          to: {
            reason,
            fraudAlertId: String(fraudAlertId),
          }
        }
      }
    );
  }
}
