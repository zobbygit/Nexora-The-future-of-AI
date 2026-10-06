import Stripe from 'stripe';
import { env } from '../config/env';
import { Payment, StripeEvent, Subscription } from '../models/Subscription';
import { User } from '../models/User';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { applyPlanChange } from './credit.service';
import { rawSetting, saveSetting } from './settings.service';
import { adminEvent, notify } from './notification.service';

let client: Stripe | null = null;
const clientBase = () => env.CLIENT_URL.replace(/\/+$/, '');
/** Billing works as soon as a secret key exists — the Pro price is created on demand if STRIPE_PRO_PRICE_ID is unset. */
export const stripeConfigured = () => !!env.STRIPE_SECRET_KEY;
export const stripeMissing = (): string[] => {
  const m: string[] = [];
  if (!env.STRIPE_SECRET_KEY) m.push('STRIPE_SECRET_KEY');
  if (!env.STRIPE_WEBHOOK_SECRET) m.push('STRIPE_WEBHOOK_SECRET');
  return m;
};
export const getStripe = (): Stripe => {
  if (!env.STRIPE_SECRET_KEY) throw new AppError(503, 'BILLING_UNAVAILABLE', 'Billing is not configured yet.');
  return (client ||= new Stripe(env.STRIPE_SECRET_KEY));
};
export const stripeMode = () => (env.STRIPE_SECRET_KEY.startsWith('sk_live') ? 'live' : 'test');

let cachedPriceId = '';
/** Returns the Pro price id: env var → saved setting → find/create "Nexora Pro" ₹400/month in Stripe. */
export const ensureProPrice = async (): Promise<string> => {
  if (env.STRIPE_PRO_PRICE_ID) return env.STRIPE_PRO_PRICE_ID;
  if (cachedPriceId) return cachedPriceId;
  const saved = (await rawSetting('stripeProPriceId')) as string | undefined;
  if (saved) return (cachedPriceId = saved);
  const stripe = getStripe();
  const products = await stripe.products.list({ active: true, limit: 100 });
  const product = products.data.find((p) => p.name === 'Nexora Pro') || (await stripe.products.create({ name: 'Nexora Pro', description: 'All 13 Nexora AI tools with monthly Pro credits.' }));
  const prices = await stripe.prices.list({ product: product.id, active: true, limit: 20 });
  const price = prices.data.find((p) => p.currency === 'inr' && p.unit_amount === 40000 && p.recurring?.interval === 'month')
    || (await stripe.prices.create({ product: product.id, currency: 'inr', unit_amount: 40000, recurring: { interval: 'month' }, nickname: 'Nexora Pro monthly' }));
  await saveSetting('stripeProPriceId', price.id);
  return (cachedPriceId = price.id);
};

export const createCheckout = async (user: any) => {
  if (!stripeConfigured()) throw new AppError(503, 'BILLING_UNAVAILABLE', 'Billing is not configured yet.');
  const stripe = getStripe();
  const priceId = await ensureProPrice();
  let customerId = user.stripeCustomerId as string | undefined;
  if (!customerId) {
    const c = await stripe.customers.create({ email: user.email, name: user.name, metadata: { userId: String(user._id) } });
    customerId = c.id;
    await User.updateOne({ _id: user._id }, { stripeCustomerId: customerId });
  }
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription', customer: customerId, line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: String(user._id), metadata: { userId: String(user._id) },
    subscription_data: { metadata: { userId: String(user._id) } },
    success_url: `${clientBase()}/app/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${clientBase()}/app/billing?checkout=cancelled`,
    allow_promotion_codes: true,
  });
  return session.url!;
};

export const createPortal = async (user: any) => {
  if (!user.stripeCustomerId) throw new AppError(400, 'NO_CUSTOMER', 'No billing account yet.');
  const s = await getStripe().billingPortal.sessions.create({ customer: user.stripeCustomerId, return_url: `${clientBase()}/app/billing` });
  return s.url;
};

export const cancelAtPeriodEnd = async (userId: string) => {
  const sub = await Subscription.findOne({ userId, status: { $in: ['active', 'trialing', 'past_due'] } }).sort({ createdAt: -1 });
  if (!sub) throw new AppError(404, 'NO_SUBSCRIPTION', 'You do not have an active subscription.');
  await getStripe().subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: true });
  // State is finalised by the webhook; reflect intent immediately for the UI.
  sub.cancelAtPeriodEnd = true;
  sub.history.push({ event: 'cancel_requested', status: sub.status, at: new Date() });
  await sub.save();
  return sub;
};

export const resumeSubscription = async (userId: string) => {
  const sub = await Subscription.findOne({ userId, status: { $in: ['active', 'trialing'] }, cancelAtPeriodEnd: true });
  if (!sub) throw new AppError(404, 'NO_SUBSCRIPTION', 'Nothing to resume.');
  await getStripe().subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: false });
  sub.cancelAtPeriodEnd = false;
  sub.history.push({ event: 'resume_requested', status: sub.status, at: new Date() });
  await sub.save();
  return sub;
};

// ── Webhook handling ─────────────────────────────────────
const ts = (n?: number | null) => (n ? new Date(n * 1000) : undefined);
const userIdFrom = async (obj: { metadata?: Stripe.Metadata | null; customer?: any }): Promise<string | undefined> => {
  if (obj.metadata?.userId) return obj.metadata.userId;
  const cid = typeof obj.customer === 'string' ? obj.customer : obj.customer?.id;
  if (!cid) return undefined;
  const u = await User.findOne({ stripeCustomerId: cid }).select('_id');
  return u ? String(u._id) : undefined;
};

export const verifyWebhook = (raw: Buffer, signature: string | undefined): Stripe.Event => {
  if (!env.STRIPE_WEBHOOK_SECRET) throw new AppError(503, 'BILLING_UNAVAILABLE', 'Webhook secret not configured.');
  if (!signature) throw new AppError(400, 'BAD_SIGNATURE', 'Missing Stripe signature.');
  try {
    return Stripe.webhooks.constructEvent(raw, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    throw new AppError(400, 'BAD_SIGNATURE', 'Webhook signature verification failed.');
  }
};

const syncSubscription = async (sub: Stripe.Subscription, event: string) => {
  const userId = await userIdFrom(sub);
  if (!userId) { logger.warn('stripe: subscription without user', { id: sub.id }); return; }
  const item = sub.items?.data?.[0] as any;
  const periodEnd = ts(item?.current_period_end ?? (sub as any).current_period_end);
  const periodStart = ts(item?.current_period_start ?? (sub as any).current_period_start);
  const doc = await Subscription.findOneAndUpdate(
    { stripeSubscriptionId: sub.id },
    {
      $set: {
        userId, stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id, priceId: item?.price?.id,
        status: sub.status, cancelAtPeriodEnd: sub.cancel_at_period_end, currentPeriodStart: periodStart, currentPeriodEnd: periodEnd,
        canceledAt: ts(sub.canceled_at), amountInr: (item?.price?.unit_amount ?? 40000) / 100,
      },
      $push: { history: { event, status: sub.status, at: new Date() } },
    },
    { upsert: true, new: true },
  );

  const user = await User.findById(userId);
  if (!user) return;
  const entitled = ['active', 'trialing'].includes(sub.status);
  if (entitled && user.plan !== 'pro') {
    await applyPlanChange(userId, 'pro', 'Upgraded to Nexora Pro');
    void notify(userId, 'subscription', 'Welcome to Nexora Pro', 'All tools are unlocked and your Pro credits are ready.', '/app/billing');
    adminEvent('subscription', { userId, status: 'pro_started' });
  } else if (!entitled && ['canceled', 'unpaid', 'incomplete_expired'].includes(sub.status) && user.plan === 'pro') {
    // Another live subscription would keep the user on Pro.
    const other = await Subscription.exists({ userId, _id: { $ne: doc._id }, status: { $in: ['active', 'trialing'] } });
    if (!other) {
      await applyPlanChange(userId, 'free', 'Pro subscription ended');
      void notify(userId, 'subscription', 'Your Pro plan has ended', 'You are back on the Free plan. Upgrade any time.', '/app/billing');
      adminEvent('subscription', { userId, status: 'pro_ended' });
    }
  }
};

export const handleStripeEvent = async (event: Stripe.Event) => {
  // Idempotency: a replayed event is acknowledged but not re-applied.
  try {
    await StripeEvent.create({ eventId: event.id, type: event.type });
  } catch (e) {
    if ((e as any).code === 11000) return { duplicate: true };
    throw e;
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const s = event.data.object as Stripe.Checkout.Session;
      if (s.mode === 'subscription' && s.subscription) {
        const sub = await getStripe().subscriptions.retrieve(typeof s.subscription === 'string' ? s.subscription : s.subscription.id);
        await syncSubscription(sub, 'checkout_completed');
      }
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await syncSubscription(event.data.object as Stripe.Subscription, event.type.replace('customer.subscription.', 'subscription_'));
      break;
    case 'invoice.payment_succeeded':
    case 'invoice.paid': {
      const inv = event.data.object as any;
      const userId = await userIdFrom({ customer: inv.customer, metadata: inv.subscription_details?.metadata });
      await Payment.updateOne(
        { stripeInvoiceId: inv.id },
        { $set: { userId, stripeSubscriptionId: inv.subscription || inv.parent?.subscription_details?.subscription, amount: inv.amount_paid / 100, currency: inv.currency, status: 'paid', description: inv.lines?.data?.[0]?.description || 'Nexora Pro', receiptUrl: inv.hosted_invoice_url } },
        { upsert: true },
      );
      if (userId) void notify(userId, 'payment', 'Payment received', `₹${(inv.amount_paid / 100).toFixed(0)} paid for Nexora Pro.`, '/app/billing');
      break;
    }
    case 'invoice.payment_failed': {
      const inv = event.data.object as any;
      const userId = await userIdFrom({ customer: inv.customer });
      await Payment.updateOne(
        { stripeInvoiceId: inv.id },
        { $set: { userId, amount: inv.amount_due / 100, currency: inv.currency, status: 'failed', description: 'Payment failed', receiptUrl: inv.hosted_invoice_url } },
        { upsert: true },
      );
      if (userId) {
        void notify(userId, 'payment', 'Payment failed', 'We could not charge your card. Update your payment method to keep Pro.', '/app/billing');
        adminEvent('payment_failed', { userId });
      }
      break;
    }
    default:
      break;
  }
  return { duplicate: false };
};

/**
 * Reconciles a user's plan with Stripe's own records — used when the webhook has not arrived (or was never
 * configured). Everything is read from Stripe's API server-side; nothing the browser sends is trusted:
 * a session id is only honoured if Stripe says it belongs to THIS user.
 */
export const syncUserFromStripe = async (user: any, sessionId?: string) => {
  const stripe = getStripe();
  let customerId: string | undefined = user.stripeCustomerId;
  const synced: string[] = [];

  if (sessionId) {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const owner = session.client_reference_id || session.metadata?.userId;
    if (owner !== String(user._id)) throw new AppError(403, 'SESSION_MISMATCH', 'That checkout session does not belong to your account.');
    if (typeof session.customer === 'string' && !customerId) {
      customerId = session.customer;
      await User.updateOne({ _id: user._id }, { stripeCustomerId: customerId });
    }
    if (session.mode === 'subscription' && session.subscription) {
      const sub = await stripe.subscriptions.retrieve(typeof session.subscription === 'string' ? session.subscription : session.subscription.id);
      await syncSubscription(sub, 'sync_checkout');
      synced.push(sub.id);
    }
  }
  if (customerId) {
    const subs = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 10 });
    for (const sub of subs.data) { if (!synced.includes(sub.id)) { await syncSubscription(sub, 'sync_customer'); synced.push(sub.id); } }
    // Backfill payment history that a missing webhook never recorded.
    const invoices = await stripe.invoices.list({ customer: customerId, limit: 20 });
    for (const inv of invoices.data as any[]) {
      if (!inv.id || inv.status !== 'paid') continue;
      await Payment.updateOne({ stripeInvoiceId: inv.id }, { $setOnInsert: { userId: user._id, stripeSubscriptionId: inv.subscription || undefined, amount: inv.amount_paid / 100, currency: inv.currency, status: 'paid', description: inv.lines?.data?.[0]?.description || 'Nexora Pro', receiptUrl: inv.hosted_invoice_url } }, { upsert: true });
    }
  }
  return { synced: synced.length, plan: (await User.findById(user._id).select('plan'))?.plan };
};