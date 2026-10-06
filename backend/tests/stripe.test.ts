jest.mock('../src/models/Subscription', () => ({
  Subscription: { findOneAndUpdate: jest.fn(async () => ({ _id: 's1' })), exists: jest.fn(async () => null) },
  Payment: { updateOne: jest.fn().mockResolvedValue({}) },
  StripeEvent: { create: jest.fn() },
}));
jest.mock('../src/models/User', () => ({ User: { findById: jest.fn(), findOne: jest.fn(), updateOne: jest.fn() } }));
jest.mock('../src/services/credit.service', () => ({ applyPlanChange: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../src/services/notification.service', () => ({ notify: jest.fn(), adminEvent: jest.fn() }));
import request from 'supertest';
import Stripe from 'stripe';
import { createApp } from '../src/app';
import { StripeEvent, Subscription } from '../src/models/Subscription';
import { User } from '../src/models/User';
import { applyPlanChange } from '../src/services/credit.service';

const app = createApp();
const secret = 'whsec_testsecret';
const sign = (payload: string) => Stripe.webhooks.generateTestHeaderString({ payload, secret });
const subEvent = (type: string, status: string, id = 'evt_1') => JSON.stringify({
  id, object: 'event', type, data: { object: { id: 'sub_1', object: 'subscription', status, customer: 'cus_1', cancel_at_period_end: false, metadata: { userId: 'u1' }, items: { data: [{ price: { id: 'price_test', unit_amount: 40000 }, current_period_start: 1, current_period_end: 2 }] } } },
});
const post = (body: string, sig?: string) => request(app).post('/api/billing/webhook').set('Content-Type', 'application/json').set('stripe-signature', sig ?? sign(body)).send(body);

beforeEach(() => { jest.clearAllMocks(); (StripeEvent.create as jest.Mock).mockResolvedValue({}); });

describe('stripe webhook', () => {
  it('rejects requests with a bad signature', async () => {
    const body = subEvent('customer.subscription.created', 'active');
    const res = await post(body, 't=1,v1=deadbeef');
    expect(res.status).toBe(400);
    expect(applyPlanChange).not.toHaveBeenCalled();
  });

  it('rejects requests with no signature', async () => {
    const res = await request(app).post('/api/billing/webhook').set('Content-Type', 'application/json').send('{}');
    expect(res.status).toBe(400);
  });

  it('upgrades the user to Pro only from a verified active subscription event', async () => {
    (User.findById as jest.Mock).mockResolvedValue({ _id: 'u1', plan: 'free' });
    const res = await post(subEvent('customer.subscription.created', 'active'));
    expect(res.status).toBe(200);
    expect(Subscription.findOneAndUpdate).toHaveBeenCalled();
    expect(applyPlanChange).toHaveBeenCalledWith('u1', 'pro', expect.any(String));
  });

  it('does not upgrade for incomplete subscriptions', async () => {
    (User.findById as jest.Mock).mockResolvedValue({ _id: 'u1', plan: 'free' });
    await post(subEvent('customer.subscription.updated', 'incomplete'));
    expect(applyPlanChange).not.toHaveBeenCalled();
  });

  it('downgrades to Free when the subscription is cancelled', async () => {
    (User.findById as jest.Mock).mockResolvedValue({ _id: 'u1', plan: 'pro' });
    await post(subEvent('customer.subscription.deleted', 'canceled'));
    expect(applyPlanChange).toHaveBeenCalledWith('u1', 'free', expect.any(String));
  });

  it('is idempotent for replayed events', async () => {
    (StripeEvent.create as jest.Mock).mockRejectedValue({ code: 11000 });
    const res = await post(subEvent('customer.subscription.created', 'active', 'evt_dup'));
    expect(res.status).toBe(200);
    expect(res.body.duplicate).toBe(true);
    expect(applyPlanChange).not.toHaveBeenCalled();
  });

  it('records failed payments', async () => {
    (User.findOne as jest.Mock).mockReturnValue({ select: async () => ({ _id: 'u1' }) });
    const body = JSON.stringify({ id: 'evt_pf', object: 'event', type: 'invoice.payment_failed', data: { object: { id: 'in_1', customer: 'cus_1', amount_due: 40000, currency: 'inr' } } });
    const res = await post(body);
    expect(res.status).toBe(200);
    const { Payment } = jest.requireMock('../src/models/Subscription');
    expect(Payment.updateOne.mock.calls[0][1].$set).toMatchObject({ status: 'failed', amount: 400 });
  });
});
