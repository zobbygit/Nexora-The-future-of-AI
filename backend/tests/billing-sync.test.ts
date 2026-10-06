const stripeMock = {
  checkout: { sessions: { retrieve: jest.fn() } },
  subscriptions: { retrieve: jest.fn(), list: jest.fn() },
  invoices: { list: jest.fn() },
};
jest.mock('stripe', () => {
  const S: any = jest.fn(() => stripeMock);
  S.webhooks = { constructEvent: jest.fn() };
  return { __esModule: true, default: S };
});
jest.mock('../src/models/Subscription', () => ({
  Subscription: { findOneAndUpdate: jest.fn(async () => ({ _id: 's1' })), exists: jest.fn(async () => null) },
  Payment: { updateOne: jest.fn().mockResolvedValue({}) },
  StripeEvent: { create: jest.fn() },
}));
jest.mock('../src/models/User', () => ({ User: { findById: jest.fn(), findOne: jest.fn(), updateOne: jest.fn().mockResolvedValue({}) } }));
jest.mock('../src/services/credit.service', () => ({ applyPlanChange: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../src/services/notification.service', () => ({ notify: jest.fn(), adminEvent: jest.fn() }));
jest.mock('../src/services/settings.service', () => ({ rawSetting: jest.fn(async () => 'price_saved'), saveSetting: jest.fn() }));

import { applyPlanChange } from '../src/services/credit.service';
import { User } from '../src/models/User';
import { ensureProPrice, stripeConfigured, stripeMissing, syncUserFromStripe } from '../src/services/stripe.service';

const activeSub = { id: 'sub_1', status: 'active', customer: 'cus_1', cancel_at_period_end: false, metadata: { userId: 'u1' }, items: { data: [{ price: { id: 'p', unit_amount: 40000 }, current_period_start: 1, current_period_end: 2 }] } };
beforeEach(() => { jest.clearAllMocks(); stripeMock.invoices.list.mockResolvedValue({ data: [] }); stripeMock.subscriptions.list.mockResolvedValue({ data: [] }); });

describe('billing works without a pre-created price id', () => {
  it('is "configured" with only a secret key, and uses the saved/auto-created price', async () => {
    expect(stripeConfigured()).toBe(true);
    expect(stripeMissing()).not.toContain('STRIPE_SECRET_KEY');
    await expect(ensureProPrice()).resolves.toBeTruthy();
  });
});

describe('sync from Stripe (webhook-less repair)', () => {
  it('upgrades the user after a verified checkout session that belongs to them', async () => {
    stripeMock.checkout.sessions.retrieve.mockResolvedValue({ client_reference_id: 'u1', customer: 'cus_1', mode: 'subscription', subscription: 'sub_1' });
    stripeMock.subscriptions.retrieve.mockResolvedValue(activeSub);
    (User.findById as jest.Mock).mockImplementation(() => { const p: any = Promise.resolve({ _id: 'u1', plan: 'free' }); p.select = async () => ({ plan: 'pro' }); return p; });
    const out = await syncUserFromStripe({ _id: 'u1', plan: 'free' }, 'cs_test_123');
    expect(applyPlanChange).toHaveBeenCalledWith('u1', 'pro', expect.any(String));
    expect(out.synced).toBe(1);
  });

  it('refuses a checkout session that belongs to someone else', async () => {
    stripeMock.checkout.sessions.retrieve.mockResolvedValue({ client_reference_id: 'someone-else', customer: 'cus_9', mode: 'subscription', subscription: 'sub_9' });
    await expect(syncUserFromStripe({ _id: 'u1', plan: 'free' }, 'cs_test_evil')).rejects.toMatchObject({ status: 403, code: 'SESSION_MISMATCH' });
    expect(applyPlanChange).not.toHaveBeenCalled();
  });

  it('repairs a user who already paid but whose webhook never arrived (customer lookup, no session id)', async () => {
    stripeMock.subscriptions.list.mockResolvedValue({ data: [activeSub] });
    (User.findById as jest.Mock).mockImplementation(() => { const p: any = Promise.resolve({ _id: 'u1', plan: 'free' }); p.select = async () => ({ plan: 'pro' }); return p; });
    await syncUserFromStripe({ _id: 'u1', plan: 'free', stripeCustomerId: 'cus_1' });
    expect(applyPlanChange).toHaveBeenCalledWith('u1', 'pro', expect.any(String));
  });

  it('leaves a free user free when Stripe has no active subscription', async () => {
    stripeMock.subscriptions.list.mockResolvedValue({ data: [{ ...activeSub, status: 'incomplete' }] });
    (User.findById as jest.Mock).mockImplementation(() => { const p: any = Promise.resolve({ _id: 'u1', plan: 'free' }); p.select = async () => ({ plan: 'free' }); return p; });
    const out = await syncUserFromStripe({ _id: 'u1', plan: 'free', stripeCustomerId: 'cus_1' });
    expect(applyPlanChange).not.toHaveBeenCalled();
    expect(out.plan).toBe('free');
  });
});