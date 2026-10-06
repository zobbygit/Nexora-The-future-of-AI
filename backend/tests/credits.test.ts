jest.mock('../src/models/User', () => ({ User: { findOneAndUpdate: jest.fn(), updateOne: jest.fn().mockResolvedValue({}), findById: jest.fn() } }));
jest.mock('../src/models/CreditTransaction', () => ({ CreditTransaction: { create: jest.fn().mockResolvedValue({}) } }));
jest.mock('../src/services/settings.service', () => ({
  getPlan: jest.fn(async (p: string) => (p === 'free' ? { creditsPerPeriod: 20, period: 'day' } : { creditsPerPeriod: 3000, period: 'month' })),
}));
import { User } from '../src/models/User';
import { CreditTransaction } from '../src/models/CreditTransaction';
import { commitCredits, ensureFreshCredits, releaseCredits, reserveCredits } from '../src/services/credit.service';
import { nextDailyReset } from '../src/utils/dates';

const U = User as unknown as { findOneAndUpdate: jest.Mock; updateOne: jest.Mock; findById: jest.Mock };
beforeEach(() => jest.clearAllMocks());

describe('daily reset boundary', () => {
  it('resets at the next midnight in the configured offset (IST)', () => {
    const now = new Date('2026-03-10T10:00:00Z'); // 15:30 IST
    expect(nextDailyReset(now, 330).toISOString()).toBe('2026-03-10T18:30:00.000Z'); // 00:00 IST on the 11th
  });
  it('rolls over exactly at the boundary', () => {
    expect(nextDailyReset(new Date('2026-03-10T18:30:00Z'), 330).toISOString()).toBe('2026-03-11T18:30:00.000Z');
  });
});

describe('credit reservation & charging', () => {
  it('rejects with 402 when the balance (minus reservations) is too low', async () => {
    U.findOneAndUpdate.mockResolvedValue(null);
    await expect(reserveCredits('u1', 5)).rejects.toMatchObject({ status: 402, code: 'INSUFFICIENT_CREDITS' });
  });

  it('reserves atomically using a guarded update', async () => {
    U.findOneAndUpdate.mockResolvedValue({ credits: 20 });
    await reserveCredits('u1', 5);
    const [filter, update] = U.findOneAndUpdate.mock.calls[0];
    expect(filter.$expr).toBeDefined();
    expect(update).toEqual({ $inc: { reservedCredits: 5 } });
  });

  it('charges once and records a traceable transaction', async () => {
    U.findOneAndUpdate.mockResolvedValue({ credits: 13 });
    const after = await commitCredits('u1', 2, { tool: 'writer', generationId: 'g1' });
    expect(after).toBe(13);
    expect(CreditTransaction.create).toHaveBeenCalledTimes(1);
    expect((CreditTransaction.create as jest.Mock).mock.calls[0][0]).toMatchObject({
      type: 'AI_GENERATION', amount: -2, balanceBefore: 15, balanceAfter: 13, tool: 'writer', generationId: 'g1',
    });
  });

  it('releasing a reservation never touches the balance', async () => {
    await releaseCredits('u1', 3);
    expect(U.updateOne.mock.calls[0][1]).toEqual({ $inc: { reservedCredits: -3 } });
    expect(CreditTransaction.create).not.toHaveBeenCalled();
  });
});

describe('free credits reset instead of accumulating', () => {
  it('sets the balance to the plan amount and logs DAILY_RESET', async () => {
    const stale = { _id: 'u1', plan: 'free', credits: 13, creditsResetAt: new Date(Date.now() - 1000) };
    U.findById.mockResolvedValue(stale);
    U.findOneAndUpdate.mockResolvedValue({ ...stale, credits: 20 });
    await ensureFreshCredits('u1');
    expect(U.findOneAndUpdate.mock.calls[0][1].$set.credits).toBe(20);
    expect((CreditTransaction.create as jest.Mock).mock.calls[0][0]).toMatchObject({ type: 'DAILY_RESET', balanceBefore: 13, balanceAfter: 20 });
  });

  it('REGRESSION: returns the full user document (isActive, onboarding, name), never a projection', async () => {
    const full = { _id: 'u1', plan: 'free', credits: 13, isActive: true, name: 'Zed', onboardingCompleted: true, creditsResetAt: new Date(Date.now() + 3600_000) };
    U.findById.mockResolvedValue(full);
    const u: any = await ensureFreshCredits('u1');
    expect(u.isActive).toBe(true);
    expect(u.onboardingCompleted).toBe(true);
    expect(u.name).toBe('Zed');
    // a projected query would return an object with a chained .select() — make sure we never call it
    expect(U.findById).toHaveBeenCalledWith('u1');
  });

  it('does nothing before the reset time', async () => {
    const fresh = { _id: 'u1', plan: 'free', credits: 13, creditsResetAt: new Date(Date.now() + 3600_000) };
    U.findById.mockResolvedValue(fresh);
    await ensureFreshCredits('u1');
    expect(U.findOneAndUpdate).not.toHaveBeenCalled();
  });
});