import { Schema, model } from 'mongoose';

const subscriptionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    stripeSubscriptionId: { type: String, required: true, unique: true },
    stripeCustomerId: { type: String, required: true },
    priceId: String,
    status: {
      type: String,
      enum: ['incomplete', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete_expired', 'paused'],
      required: true,
      index: true,
    },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    canceledAt: Date,
    amountInr: { type: Number, default: 400 },
    history: {
      type: [{ event: String, status: String, at: { type: Date, default: Date.now } }],
      default: [],
    },
  },
  { timestamps: true },
);

export const Subscription = model('Subscription', subscriptionSchema);

const paymentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    stripeInvoiceId: { type: String, unique: true, sparse: true },
    stripeSubscriptionId: String,
    amount: { type: Number, required: true },
    currency: { type: String, default: 'inr' },
    status: { type: String, enum: ['paid', 'failed', 'refunded'], required: true },
    description: String,
    receiptUrl: String,
  },
  { timestamps: true },
);
export const Payment = model('Payment', paymentSchema);

/** Idempotency ledger so replayed Stripe webhooks never double-apply. */
const stripeEventSchema = new Schema(
  { eventId: { type: String, unique: true, required: true }, type: String },
  { timestamps: true },
);
stripeEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });
export const StripeEvent = model('StripeEvent', stripeEventSchema);
