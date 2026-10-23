import Stripe from 'stripe';
import mongoose from 'mongoose';
import { PaymentMethod, PaymentMethodType, PaymentMethodStatus, IPaymentMethod } from '../models/PaymentMethod';
import { Transaction, TransactionType, TransactionStatus, ITransaction, IProcessor } from '../models/Transaction';
import { AuditLogService } from './AuditLogService';
import { AuditActionType, ResourceType } from '../models/AuditLog';

/**
 * StripeService
 * 
 * Handles all Stripe payment processing:
 * - Payment intents (charge creation)
 * - Token management
 * - Webhook handling
 * - Refunds
 * - Payment method management
 * - Dispute handling
 */

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

interface ChargeRequest {
  userId: mongoose.Types.ObjectId;
  paymentMethodId: mongoose.Types.ObjectId;
  amount: number;
  currency?: string;
  description: string;
  orderId?: mongoose.Types.ObjectId;
  fraudScore?: number;
  metadata?: Record<string, string>;
  idempotencyKey: string;
}

interface RefundRequest {
  transactionId: mongoose.Types.ObjectId;
  amount?: number; // If omitted, refund full amount
  reason?: string;
}

interface CreatePaymentMethodRequest {
  userId: mongoose.Types.ObjectId;
  stripePaymentMethodId: string; // From Stripe
  displayName: string;
  type: PaymentMethodType;
  setAsDefault?: boolean;
}

export class StripeService {
  /**
   * Create payment intent and charge
   * 
   * Main entry point for processing payments
   */
  static async charge(request: ChargeRequest): Promise<ITransaction> {
    const { userId, paymentMethodId, amount, currency = 'USD', description, orderId, fraudScore, idempotencyKey, metadata } = request;

    try {
      // Get payment method
      const paymentMethod = await PaymentMethod.findById(paymentMethodId);
      if (!paymentMethod || paymentMethod.status !== PaymentMethodStatus.ACTIVE) {
        throw new Error('Payment method not available');
      }

      if (!paymentMethod.stripeTokenId) {
        throw new Error('Payment method not properly configured');
      }

      // Create payment intent
      const paymentIntent = await stripe.paymentIntents.create(
        {
          amount: Math.round(amount), // Must be integer (in cents)
          currency: currency.toLowerCase(),
          payment_method: paymentMethod.stripeTokenId,
          confirm: true,
          description,
          metadata: {
            userId: userId.toString(),
            orderId: orderId?.toString() || 'none',
            fraudScore: fraudScore?.toString() || 'none',
            ...metadata,
          },
          off_session: true, // Stored payment method
        },
        {
          idempotencyKey, // Prevents duplicate charges on retry
        }
      );

      // Create transaction record
      const transaction = await Transaction.create({
        order: orderId,
        user: userId,
        paymentMethod: paymentMethodId,
        type: TransactionType.CHARGE,
        status: TransactionStatus.PENDING,
        amount: Math.round(amount),
        currency,
        processor: {
          name: 'stripe',
          transactionId: paymentIntent.id,
          authorizationCode: paymentIntent.client_secret,
        },
        fraudScore,
        description,
        idempotencyKey,
        requestedAt: new Date(),
      });

      // Handle based on payment intent status
      if (paymentIntent.status === 'succeeded') {
        // Get latest charge info if available (can be null, string ID, or Charge object)
        let latestCharge = null;
        if (paymentIntent.latest_charge) {
          latestCharge = typeof paymentIntent.latest_charge === 'string' 
            ? await stripe.charges.retrieve(paymentIntent.latest_charge)
            : paymentIntent.latest_charge;
        }

        const processorUpdate: IProcessor = {
          name: 'stripe',
          transactionId: paymentIntent.id,
          authorizationCode: paymentIntent.client_secret || undefined,
          avsResult: latestCharge?.payment_method_details?.card?.checks?.address_line1_check || undefined,
          cvvResult: latestCharge?.payment_method_details?.card?.checks?.cvc_check || undefined,
          riskLevel: latestCharge?.outcome?.risk_level || undefined,
          riskDetails: latestCharge?.outcome || undefined,
        };

        await transaction.updateStatus(TransactionStatus.SUCCEEDED, processorUpdate);

        // Mark payment method as used
        await paymentMethod.markAsUsed();

        // Log transaction
        await AuditLogService.log(
          AuditActionType.PAYMENT_PROCESSED,
          ResourceType.TRANSACTION,
          String(transaction._id),
          String(userId),
          null,
          { payment: { from: null, to: { amount, currency, method: paymentMethod.displayName } } }
        );
      } else if (paymentIntent.status === 'requires_action') {
        await transaction.updateStatus(TransactionStatus.PROCESSING);
        // 3D Secure or other verification needed - return client_secret for frontend
      } else if (paymentIntent.status === 'requires_payment_method') {
        await transaction.recordDecline('requires_payment_method', 'Payment method required for this transaction', true);
      }

      return transaction;
    } catch (error: any) {
      // Handle payment errors
      if (error.type === 'StripeCardError') {
        // Card error (e.g., declined)
        const errorTransaction = await Transaction.create({
          order: orderId,
          user: userId,
          paymentMethod: paymentMethodId,
          type: TransactionType.CHARGE,
          amount: Math.round(amount),
          currency,
          processor: {
            name: 'stripe',
            transactionId: `stripe_error_${Date.now()}`,
          },
          fraudScore,
          description,
          idempotencyKey,
        });

        const retryable = error.decline_code !== 'fraudulent' && error.decline_code !== 'card_not_supported';
        await errorTransaction.recordDecline(error.decline_code, error.message, retryable);

        // Log decline - refetch payment method if needed
        const pm = await PaymentMethod.findById(paymentMethodId);
        if (pm) {
          await pm.recordDecline(error.message);
        }

        return errorTransaction;
      }

      throw error;
    }
  }

  /**
   * Process refund
   */
  static async refund(request: RefundRequest): Promise<ITransaction> {
    const { transactionId, amount, reason } = request;

    // Get original transaction
    const originalTxn = await Transaction.findById(transactionId);
    if (!originalTxn || originalTxn.status !== TransactionStatus.SUCCEEDED) {
      throw new Error('Cannot refund this transaction');
    }

    const refundAmount = amount || originalTxn.amount;

    try {
      // Process refund with Stripe - reason must be a valid Stripe reason type
      const refundReason = reason === 'duplicate' ? 'duplicate' : 
                           reason === 'fraudulent' ? 'fraudulent' : 'requested_by_customer';
      
      const refund = await stripe.refunds.create({
        payment_intent: originalTxn.processor.transactionId,
        amount: Math.round(refundAmount),
        reason: refundReason,
        metadata: {
          originalTransactionId: transactionId.toString(),
        },
      });

      // Create refund transaction record
      const refundTxn = await Transaction.createRefund(originalTxn, refundAmount, {
        name: 'stripe',
        transactionId: refund.id,
      });

      // Update refund status
      if (refund.status === 'succeeded') {
        await refundTxn.updateStatus(TransactionStatus.REFUNDED);
      }

      return refundTxn;
    } catch (error) {
      throw new Error(`Refund failed: ${error}`);
    }
  }

  /**
   * Create or save a payment method
   */
  static async createPaymentMethod(request: CreatePaymentMethodRequest): Promise<IPaymentMethod> {
    const { userId, stripePaymentMethodId, displayName, type, setAsDefault } = request;

    // Get payment method details from Stripe
    const stripeMethod = await stripe.paymentMethods.retrieve(stripePaymentMethodId);

    // Check for duplicate cards (by fingerprint)
    if (type === PaymentMethodType.CREDIT_CARD || type === PaymentMethodType.DEBIT_CARD) {
      const cardFingerprint = stripeMethod.card?.fingerprint;
      if (cardFingerprint) {
        const existing = await PaymentMethod.findByCardFingerprint(cardFingerprint);
        if (existing.length > 0) {
          throw new Error('This card is already saved');
        }
      }
    }

    // If this is the default, unset other defaults
    if (setAsDefault) {
      await PaymentMethod.updateMany(
        { user: userId, isDefault: true },
        { isDefault: false }
      );
    }

    // Create payment method record
    const cardData = stripeMethod.card;
    const card = cardData
      ? {
          brand: cardData.brand,
          last4: cardData.last4,
          expMonth: cardData.exp_month,
          expYear: cardData.exp_year,
          fingerprint: cardData.fingerprint || '',
          country: cardData.country || 'US',
        }
      : undefined;

    const paymentMethod = await PaymentMethod.create({
      user: userId,
      type,
      stripeTokenId: stripePaymentMethodId,
      displayName,
      card,
      isDefault: setAsDefault || false,
    });

    return paymentMethod;
  }

  /**
   * Delete a payment method
   */
  static async deletePaymentMethod(paymentMethodId: mongoose.Types.ObjectId): Promise<void> {
    const paymentMethod = await PaymentMethod.findById(paymentMethodId);
    if (!paymentMethod) {
      throw new Error('Payment method not found');
    }

    if (paymentMethod.stripeTokenId) {
      await stripe.paymentMethods.detach(paymentMethod.stripeTokenId);
    }

    await paymentMethod.delete();
  }

  /**
   * Verify webhook signature and process webhook
   */
  static async processWebhook(body: Buffer, signature: string): Promise<void> {
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const transaction = await Transaction.findOne({
          'processor.transactionId': paymentIntent.id,
        });

        if (transaction) {
          await transaction.updateStatus(TransactionStatus.SUCCEEDED);
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const transaction = await Transaction.findOne({
          'processor.transactionId': paymentIntent.id,
        });

        if (transaction) {
          await transaction.updateStatus(TransactionStatus.FAILED);
        }
        break;
      }

      case 'charge.dispute.created': {
        const dispute = event.data.object as Stripe.Dispute;
        // Create chargeback record - TODO: Add ChargbackModel
        console.log('Dispute received:', dispute.id);
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const transaction = await Transaction.findOne({
          'processor.transactionId': charge.payment_intent,
        });

        if (transaction) {
          await transaction.updateStatus(TransactionStatus.REFUNDED);
        }
        break;
      }
    }
  }

  /**
   * Get payment intent status
   */
  static async getPaymentStatus(paymentIntentId: string) {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return {
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      clientSecret: paymentIntent.client_secret,
    };
  }

  /**
   * List customer's payment methods
   */
  static async listPaymentMethods(userId: mongoose.Types.ObjectId) {
    return PaymentMethod.findActive(userId);
  }

  /**
   * Retrieve Stripe publishable key (for frontend)
   */
  static getPublishableKey(): string {
    return process.env.STRIPE_PUBLISHABLE_KEY || '';
  }
}
