import express from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import StripeConnectService from '../services/stripeConnectService';

const router = express.Router();

/**
 * Stripe Connect routes — marketplace seller payouts.
 *
 * All routes require authentication + seller role. The flow:
 *   1. POST   /api/connect/account         — create Connect Express account
 *   2. GET    /api/connect/onboarding       — get hosted onboarding URL
 *   3. GET    /api/connect/account          — account status (payouts enabled?)
 *   4. POST   /api/connect/payouts          — trigger a payout to seller bank
 *   5. GET    /api/connect/payouts          — list recent payouts
 */

router.use(authenticate, requireRole('seller', 'admin'));

// Create a Stripe Connect Express account for the authenticated seller.
// Idempotent — returns the existing account id if one already exists.
router.post('/account', async (req, res, next) => {
  try {
    const accountId = await StripeConnectService.createAccount(String(req.user!._id));
    res.json({ success: true, data: { accountId } });
  } catch (err) {
    next(err);
  }
});

// Get the account status (payouts enabled, details submitted, requirements).
router.get('/account', async (req, res, next) => {
  try {
    const status = await StripeConnectService.getAccountStatus(String(req.user!._id));
    res.json({ success: true, data: status });
  } catch (err) {
    next(err);
  }
});

// Generate the hosted onboarding link. The seller is redirected here to
// complete their Stripe Express account setup (bank details, KYC).
router.get('/onboarding', async (req, res, next) => {
  try {
    const returnUrl = (req.query.returnUrl as string) || undefined;
    const link = await StripeConnectService.getOnboardingLink(String(req.user!._id), returnUrl);
    res.json({ success: true, data: link });
  } catch (err) {
    next(err);
  }
});

// Trigger a payout from the seller's Connect balance to their bank.
// Body: { amount: number } (in the smallest currency unit, e.g. cents).
router.post('/payouts', async (req, res, next) => {
  try {
    const amount = Number(req.body?.amount);
    if (!amount || amount <= 0) {
      res.status(400).json({ success: false, message: 'amount (in cents) is required' });
      return;
    }
    const payout = await StripeConnectService.createPayout(String(req.user!._id), amount);
    res.json({ success: true, data: payout });
  } catch (err) {
    next(err);
  }
});

// List recent payouts for the seller.
router.get('/payouts', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 10, 100);
    const payouts = await StripeConnectService.listPayouts(String(req.user!._id), limit);
    res.json({ success: true, data: payouts });
  } catch (err) {
    next(err);
  }
});

export default router;
