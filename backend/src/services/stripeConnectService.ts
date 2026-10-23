import Stripe from 'stripe';
import mongoose from 'mongoose';
import User from '../models/User';
import Store from '../models/Store';
import { AuditLogService } from './AuditLogService';
import { AuditActionType, ResourceType } from '../models/AuditLog';
import logger from '../utils/logger';

/**
 * StripeConnectService — marketplace seller payouts via Stripe Connect.
 *
 * Account type: **Express** (least onboarding friction for sellers — Stripe
 * hosts the onboarding flow; sellers don't need a full Stripe account).
 *
 * Flow:
 *  1. Seller calls `createAccount()` → Stripe Connect Express account created,
 *     `stripeAccountId` saved on the User.
 *  2. Seller calls `getOnboardingLink()` → Stripe Account Links URL returned
 *     for the hosted onboarding form.
 *  3. On order payment, the platform fee (PLATFORM_FEE_PERCENT) is reserved.
 *  4. `createPayout(sellerId, amount)` transfers funds to the seller's
 *     connected account and creates a Stripe Payout.
 *
 * Config:
 *  - STRIPE_SECRET_KEY — the platform's secret key.
 *  - PLATFORM_FEE_PERCENT — percent taken from each order (default 5).
 *  - CLIENT_URL — for the onboarding return/refresh URLs.
 */

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

const PLATFORM_FEE_PERCENT = Number(process.env.PLATFORM_FEE_PERCENT) || 5;

export interface OnboardingLinkResult {
  url: string;
  expiresAt: number;
}

export interface PayoutResult {
  transferId: string;
  payoutId?: string;
  amount: number;
  currency: string;
  status: string;
}

export const StripeConnectService = {
  /**
   * Create a Stripe Connect Express account for a seller.
   * Idempotent: if the seller already has a stripeAccountId, returns it.
   */
  async createAccount(userId: string): Promise<string> {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    if (user.stripeAccountId) {
      return user.stripeAccountId;
    }

    const account = await stripe.accounts.create({
      type: 'express',
      email: user.email,
      metadata: {
        userId: String(user._id),
        name: user.getFullName(),
      },
    });

    user.stripeAccountId = account.id;
    await user.save();

    await AuditLogService.log(
      AuditActionType.USER_UPDATED,
      ResourceType.USER,
      String(user._id),
      String(user._id),
      null,
      { stripeConnect: { from: null, to: account.id } },
    );

    logger.info({ msg: 'Stripe Connect account created', userId, accountId: account.id });
    return account.id;
  },

  /**
   * Generate an Account Links URL for the hosted onboarding flow.
   * The seller is redirected here after "Register as seller".
   */
  async getOnboardingLink(userId: string, returnUrl?: string): Promise<OnboardingLinkResult> {
    const user = await User.findById(userId);
    if (!user || !user.stripeAccountId) {
      throw new Error('Seller has no Stripe Connect account');
    }

    const baseUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const links = await stripe.accountLinks.create({
      account: user.stripeAccountId,
      refresh_url: returnUrl || `${baseUrl}/seller/onboarding/refresh`,
      return_url: `${baseUrl}/seller/onboarding/complete`,
      type: 'account_onboarding',
    });

    return {
      url: links.url,
      expiresAt: links.expires_at,
    };
  },

  /**
   * Retrieve the Connect account's capabilities (to know if payouts are enabled).
   */
  async getAccountStatus(userId: string): Promise<{
    accountId: string;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
    requirements: any;
  }> {
    const user = await User.findById(userId);
    if (!user || !user.stripeAccountId) {
      throw new Error('Seller has no Stripe Connect account');
    }

    const account = await stripe.accounts.retrieve(user.stripeAccountId);
    return {
      accountId: account.id,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      requirements: account.requirements,
    };
  },

  /**
   * Compute the platform fee for a given order amount.
   */
  computePlatformFee(orderTotal: number): number {
    return Math.round((orderTotal * PLATFORM_FEE_PERCENT) / 100);
  },

  /**
   * Create a transfer to the seller's connected account.
   * Called after an order is paid. The amount is orderTotal minus the
   * platform fee.
   */
  async createTransfer(
    sellerStripeAccountId: string,
    amount: number,
    orderId: string,
  ): Promise<Stripe.Transfer> {
    const transfer = await stripe.transfers.create({
      amount: Math.round(amount),
      currency: 'usd',
      destination: sellerStripeAccountId,
      transfer_group: orderId,
      metadata: {
        orderId,
        platformFeePercent: String(PLATFORM_FEE_PERCENT),
      },
    });
    return transfer;
  },

  /**
   * Trigger a payout from the seller's connected account balance to their bank.
   * Sellers trigger this from their dashboard ("Withdraw earnings").
   */
  async createPayout(userId: string, amount: number): Promise<PayoutResult> {
    const user = await User.findById(userId);
    if (!user || !user.stripeAccountId) {
      throw new Error('Seller has no Stripe Connect account');
    }

    const status = await this.getAccountStatus(userId);
    if (!status.payoutsEnabled) {
      throw new Error('Seller payouts are not enabled — complete Stripe onboarding first');
    }

    const payout = await stripe.payouts.create(
      {
        amount: Math.round(amount),
        currency: 'usd',
      },
      {
        stripeAccount: user.stripeAccountId,
      },
    );

    logger.info({ msg: 'Stripe Connect payout created', userId, payoutId: payout.id, amount });

    return {
      transferId: '',
      payoutId: payout.id,
      amount,
      currency: payout.currency,
      status: payout.status,
    };
  },

  /**
   * List the seller's recent payouts.
   */
  async listPayouts(userId: string, limit = 10): Promise<Stripe.Payout[]> {
    const user = await User.findById(userId);
    if (!user || !user.stripeAccountId) {
      throw new Error('Seller has no Stripe Connect account');
    }

    const payouts = await stripe.payouts.list(
      { limit },
      { stripeAccount: user.stripeAccountId },
    );
    return payouts.data;
  },
};

export default StripeConnectService;
