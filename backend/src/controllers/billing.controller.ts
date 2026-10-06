import { Request, Response } from 'express';
import { Payment, Subscription } from '../models/Subscription';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/errors';
import { env, isProd } from '../config/env';
import {
  cancelAtPeriodEnd, createCheckout, createPortal, handleStripeEvent, resumeSubscription, stripeConfigured, stripeMissing, stripeMode, syncUserFromStripe, verifyWebhook,
} from '../services/stripe.service';
import { creditSnapshot } from '../services/ai.service';
import { getPlans } from '../services/settings.service';

const subDto = (s: any) => ({
  id: String(s._id), status: s.status, cancelAtPeriodEnd: s.cancelAtPeriodEnd, currentPeriodStart: s.currentPeriodStart,
  currentPeriodEnd: s.currentPeriodEnd, canceledAt: s.canceledAt, amountInr: s.amountInr, createdAt: s.createdAt,
  history: (s.history || []).map((h: any) => ({ event: h.event, status: h.status, at: h.at })),
});

export const overview = asyncHandler(async (req: Request, res: Response) => {
  const uid = req.userId!;
  const [snap, plans, subs, payments] = await Promise.all([
    creditSnapshot(uid), getPlans(),
    Subscription.find({ userId: uid }).sort({ createdAt: -1 }).limit(10).lean(),
    Payment.find({ userId: uid }).sort({ createdAt: -1 }).limit(30).lean(),
  ]);
  const current = subs.find((s) => ['active', 'trialing', 'past_due'].includes(s.status));
  res.json({
    plan: snap.plan, credits: snap.credits, resetsAt: snap.resetsAt, plans,
    subscription: current ? subDto(current) : null,
    billingStatus: current ? (current.status === 'past_due' ? 'payment_failed' : current.cancelAtPeriodEnd ? 'cancelling' : 'active') : 'none',
    subscriptions: subs.map(subDto),
    payments: payments.map((p: any) => ({ id: String(p._id), amount: p.amount, currency: p.currency, status: p.status, description: p.description, receiptUrl: p.receiptUrl, createdAt: p.createdAt })),
    stripe: { enabled: stripeConfigured(), mode: stripeMode(), publishableKey: env.STRIPE_PUBLISHABLE_KEY || null, webhook: !!env.STRIPE_WEBHOOK_SECRET, ...(isProd ? {} : { missing: stripeMissing() }) },
  });
});

export const checkout = asyncHandler(async (req, res) => {
  if (req.user.plan === 'pro') throw new AppError(400, 'ALREADY_PRO', 'You are already on Nexora Pro.');
  res.json({ url: await createCheckout(req.user) });
});
/** Re-checks Stripe for this user's subscription (after checkout, or to repair a payment whose webhook never arrived). */
export const sync = asyncHandler(async (req, res) => {
  if (!stripeConfigured()) throw new AppError(503, 'BILLING_UNAVAILABLE', 'Billing is not configured yet.');
  const sessionId = typeof req.body?.sessionId === 'string' && /^cs_[A-Za-z0-9_]+$/.test(req.body.sessionId) ? req.body.sessionId : undefined;
  res.json(await syncUserFromStripe(req.user, sessionId));
});
export const portal = asyncHandler(async (req, res) => res.json({ url: await createPortal(req.user) }));
export const cancel = asyncHandler(async (req, res) => res.json({ subscription: subDto(await cancelAtPeriodEnd(req.userId!)) }));
export const resume = asyncHandler(async (req, res) => res.json({ subscription: subDto(await resumeSubscription(req.userId!)) }));

/** Raw-body endpoint. The plan changes ONLY here, after Stripe's signature is verified. */
export const webhook = asyncHandler(async (req, res) => {
  const event = verifyWebhook(req.body as Buffer, req.headers['stripe-signature'] as string | undefined);
  const result = await handleStripeEvent(event);
  res.json({ received: true, ...result });
});