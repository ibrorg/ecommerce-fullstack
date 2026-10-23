import axios from 'axios';
import mongoose from 'mongoose';
import { PaymentMethod, PaymentMethodType, PaymentMethodStatus, IPaymentMethod } from '../models/PaymentMethod';
import { Transaction, TransactionType, TransactionStatus, ITransaction } from '../models/Transaction';
import { AuditLogService } from './AuditLogService';
import { AuditActionType, ResourceType } from '../models/AuditLog';

/**
 * PayPalService
 * 
 * Handles all PayPal payment processing:
 * - Payment creation
 * - Payment execution
 * - Token management
 * - Webhook handling
 * - Refunds
 * - Payment method management
 */

const PAYPAL_API = process.env.PAYPAL_MODE === 'sandbox' 
  ? 'https://api.sandbox.paypal.com'
  : 'https://api.paypal.com';

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const PAYPAL_SECRET = process.env.PAYPAL_SECRET || '';

// In-memory token cache (in production, use Redis)
let accessTokenCache: { token: string; expiresAt: number } | null = null;

interface ChargeRequest {
  userId: mongoose.Types.ObjectId;
  paymentMethodId: mongoose.Types.ObjectId;
  amount: number;
  currency?: string;
  description: string;
  orderId?: mongoose.Types.ObjectId;
  fraudScore?: number;
  idempotencyKey: string;
}

interface RefundRequest {
  transactionId: mongoose.Types.ObjectId;
  amount?: number;
  reason?: string;
}

export class PayPalService {
  /**
   * Get or refresh access token
   */
  private static async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (accessTokenCache && accessTokenCache.expiresAt > Date.now()) {
      return accessTokenCache.token;
    }

    const response = await axios.post(
      `${PAYPAL_API}/v1/oauth2/token`,
      'grant_type=client_credentials',
      {
        auth: {
          username: PAYPAL_CLIENT_ID,
          password: PAYPAL_SECRET,
        },
        headers: {
          'Accept': 'application/json',
          'Accept-Language': 'en_US',
        },
      }
    );

    const token = response.data.access_token;
    const expiresIn = response.data.expires_in; // seconds

    // Cache token (refresh 60 seconds before expiry)
    accessTokenCache = {
      token,
      expiresAt: Date.now() + (expiresIn - 60) * 1000,
    };

    return token;
  }

  /**
   * Create and execute payment (vault payment)
   * Uses saved PayPal token for recurring/stored payment
   */
  static async charge(request: ChargeRequest): Promise<ITransaction> {
    const { userId, paymentMethodId, amount, currency = 'USD', description, orderId, fraudScore, idempotencyKey } = request;

    try {
      // Get payment method
      const paymentMethod = await PaymentMethod.findById(paymentMethodId);
      if (!paymentMethod || paymentMethod.status !== PaymentMethodStatus.ACTIVE) {
        throw new Error('Payment method not available');
      }

      if (!paymentMethod.paypalTokenId) {
        throw new Error('Payment method not properly configured');
      }

      // Get access token
      const accessToken = await this.getAccessToken();

      // Create payment transaction
      const response = await axios.post(
        `${PAYPAL_API}/v1/payments/payment`,
        {
          intent: 'sale',
          payer: {
            payment_method: 'paypal',
            payer_info: {
              email: paymentMethod.paypal?.email,
            },
          },
          transactions: [
            {
              amount: {
                total: (amount / 100).toFixed(2), // Convert from cents
                currency,
                details: {
                  subtotal: (amount / 100).toFixed(2),
                },
              },
              description,
              invoice_number: idempotencyKey,
            },
          ],
          redirect_urls: {
            return_url: `${process.env.APP_URL}/payment/return`,
            cancel_url: `${process.env.APP_URL}/payment/cancel`,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
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
          name: 'paypal',
          transactionId: response.data.id,
        },
        fraudScore,
        description,
        idempotencyKey,
        requestedAt: new Date(),
      });

      // For vault payments, we can auto-execute
      if (paymentMethod.paypalTokenId) {
        await this.executePayment(response.data.id, transaction, paymentMethod, accessToken);
      }

      return transaction;
    } catch (error: any) {
      throw new Error(`PayPal charge failed: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Execute already-created payment
   */
  private static async executePayment(
    paymentId: string,
    transaction: ITransaction,
    paymentMethod: IPaymentMethod,
    accessToken: string
  ): Promise<void> {
    try {
      const response = await axios.post(
        `${PAYPAL_API}/v1/payments/payment/${paymentId}/execute`,
        {
          payer_id: paymentMethod.paypal?.paypalId,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.state === 'approved') {
        const saleId = response.data.transactions[0]?.related_resources[0]?.sale?.id;
        await transaction.updateStatus(TransactionStatus.SUCCEEDED, {
          name: 'paypal',
          transactionId: paymentId,
          authorizationCode: saleId,
        });

        await paymentMethod.markAsUsed();

        await AuditLogService.log(
          AuditActionType.PAYMENT_PROCESSED,
          ResourceType.TRANSACTION,
          String(transaction._id),
          String(transaction.user),
          null,
          { payment: { from: null, to: { amount: transaction.amount, currency: transaction.currency } } }
        );
      } else {
        await transaction.updateStatus(TransactionStatus.FAILED);
      }
    } catch (error: any) {
      await transaction.recordDecline(
        'paypal_execution_failed',
        error.response?.data?.message || error.message,
        true
      );
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

    try {
      const accessToken = await this.getAccessToken();
      const refundAmount = amount || originalTxn.amount;

      // Find the sale ID (stored in authorizationCode)
      const saleId = originalTxn.processor.authorizationCode;

      const response = await axios.post(
        `${PAYPAL_API}/v1/sales/${saleId}/refund`,
        {
          amount: {
            currency: originalTxn.currency,
            total: (refundAmount / 100).toFixed(2),
          },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Create refund transaction record
      const refundTxn = await Transaction.createRefund(originalTxn, refundAmount, {
        name: 'paypal',
        transactionId: response.data.id,
      });

      if (response.data.state === 'completed') {
        await refundTxn.updateStatus(TransactionStatus.REFUNDED);
      }

      return refundTxn;
    } catch (error: any) {
      throw new Error(`PayPal refund failed: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Create/link PayPal account for user
   */
  static async linkPayPalAccount(userId: mongoose.Types.ObjectId, email: string, paypalId: string): Promise<IPaymentMethod> {
    // Check for duplicate
    const existing = await PaymentMethod.findOne({
      user: userId,
      type: PaymentMethodType.PAYPAL,
      'paypal.email': email,
    });

    if (existing) {
      throw new Error('This PayPal account is already linked');
    }

    const paymentMethod = await PaymentMethod.create({
      user: userId,
      type: PaymentMethodType.PAYPAL,
      displayName: email,
      paypalTokenId: `paypal_${email}`,
      paypal: {
        email,
        paypalId,
        verified: true,
        verifiedAt: new Date(),
      },
    });

    return paymentMethod;
  }

  /**
   * Verify webhook signature (using verification endpoint)
   */
  static async verifyWebhookSignature(
    webhookId: string,
    transmissionId: string,
    transmissionTime: string,
    certUrl: string,
    authAlgo: string,
    transmissionSig: string,
    body: string
  ): Promise<boolean> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await axios.post(
        `${PAYPAL_API}/v1/notifications/verify-webhook-signature`,
        {
          transmission_id: transmissionId,
          transmission_time: transmissionTime,
          cert_url: certUrl,
          auth_algo: authAlgo,
          transmission_sig: transmissionSig,
          webhook_id: webhookId,
          webhook_event: JSON.parse(body),
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data.verification_status === 'SUCCESS';
    } catch (error) {
      return false;
    }
  }

  /**
   * Process PayPal webhook event
   */
  static async processWebhook(event: any): Promise<void> {
    switch (event.event_type) {
      case 'PAYMENT.SALE.COMPLETED': {
        const transaction = await Transaction.findOne({
          'processor.transactionId': event.resource.id,
        });

        if (transaction) {
          await transaction.updateStatus(TransactionStatus.SUCCEEDED);
        }
        break;
      }

      case 'PAYMENT.SALE.REFUNDED': {
        const transaction = await Transaction.findOne({
          'processor.authorizationCode': event.resource.id,
        });

        if (transaction) {
          await transaction.updateStatus(TransactionStatus.REFUNDED);
        }
        break;
      }

      case 'PAYMENT.SALE.DENIED': {
        const transaction = await Transaction.findOne({
          'processor.transactionId': event.resource.id,
        });

        if (transaction) {
          await transaction.recordDecline('payment_denied', 'Payment was denied by PayPal', true);
        }
        break;
      }

      case 'CUSTOMER.DISPUTE.CREATED': {
        // Chargeback/dispute - TODO: Add dispute handling
        console.log('PayPal dispute created:', event.resource.id);
        break;
      }
    }
  }

  /**
   * Get payment details
   */
  static async getPaymentDetails(paymentId: string): Promise<any> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await axios.get(`${PAYPAL_API}/v1/payments/payment/${paymentId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to get payment details: ${error}`);
    }
  }
}
