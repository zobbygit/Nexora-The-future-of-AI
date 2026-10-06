import { Types } from 'mongoose';
import { User } from '../models/User';
import { CreditTransaction } from '../models/CreditTransaction';
import { getPlan } from './settings.service';
import { addMonths, nextDailyReset } from '../utils/dates';
import { AppError } from '../utils/errors';

type TxType = 'DAILY_RESET' | 'MONTHLY_GRANT' | 'AI_GENERATION' | 'ADMIN_ADJUSTMENT' | 'REFUND';

export const recordTx = (p: {
  userId: Types.ObjectId | string; type: TxType; amount: number; before: number; after: number;
  reason?: string; tool?: string; generationId?: Types.ObjectId | string;
}) =>
  CreditTransaction.create({
    userId: p.userId, type: p.type, amount: p.amount, balanceBefore: p.before, balanceAfter: p.after,
    reason: p.reason || '', tool: p.tool, generationId: p.generationId,
  });

/**
 * Lazily applies the plan's periodic refill. Free credits reset (never accumulate);
 * Pro credits are granted monthly. Safe under concurrency via a compare-and-set on creditsResetAt.
 */
export const ensureFreshCredits = async (userId: string | Types.ObjectId) => {
  // IMPORTANT: load the FULL document. Callers read isActive/name/onboardingCompleted from the result, so a
  // projected (partial) document silently reads as "deactivated" / "not onboarded".
  const user = await User.findById(userId);
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'Account not found.');
  const now = new Date();
  if (user.creditsResetAt && user.creditsResetAt > now) return user;

  const plan = await getPlan(user.plan as 'free' | 'pro');
  const next = plan.period === 'day' ? nextDailyReset(now) : addMonths(now, 1);
  const before = user.credits;
  const updated = await User.findOneAndUpdate(
    { _id: user._id, creditsResetAt: user.creditsResetAt },
    { $set: { credits: plan.creditsPerPeriod, creditsResetAt: next, reservedCredits: 0 } },
    { new: true },
  );
  if (updated) {
    await recordTx({
      userId: user._id, type: plan.period === 'day' ? 'DAILY_RESET' : 'MONTHLY_GRANT',
      amount: plan.creditsPerPeriod - before, before, after: plan.creditsPerPeriod,
      reason: plan.period === 'day' ? 'Daily credit reset' : 'Monthly Pro credit grant',
    });
    return updated;
  }
  return (await User.findById(userId))!;
};

/** Atomically reserves credits so concurrent requests cannot overspend. Nothing is charged yet. */
export const reserveCredits = async (userId: Types.ObjectId | string, cost: number) => {
  const res = await User.findOneAndUpdate(
    { _id: userId, $expr: { $gte: [{ $subtract: ['$credits', '$reservedCredits'] }, cost] } },
    { $inc: { reservedCredits: cost } },
    { new: true },
  );
  if (!res) throw new AppError(402, 'INSUFFICIENT_CREDITS', 'You do not have enough credits for this generation.');
  return res;
};

export const releaseCredits = async (userId: Types.ObjectId | string, cost: number) => {
  await User.updateOne({ _id: userId, reservedCredits: { $gte: cost } }, { $inc: { reservedCredits: -cost } });
};

/** Converts a reservation into a real deduction and records the transaction. Charged exactly once. */
export const commitCredits = async (
  userId: Types.ObjectId | string, cost: number, ctx: { tool: string; generationId: Types.ObjectId | string; reason?: string },
) => {
  const after = await User.findOneAndUpdate(
    { _id: userId },
    { $inc: { credits: -cost, reservedCredits: -cost } },
    { new: true },
  );
  if (!after) return;
  if (after.credits < 0) await User.updateOne({ _id: userId }, { $set: { credits: 0 } });
  const balanceAfter = Math.max(0, after.credits);
  await recordTx({
    userId, type: 'AI_GENERATION', amount: -cost, before: balanceAfter + cost, after: balanceAfter,
    reason: ctx.reason || `Used ${ctx.tool}`, tool: ctx.tool, generationId: ctx.generationId,
  });
  return balanceAfter;
};

export const adjustCredits = async (userId: string, delta: number, reason: string, type: TxType = 'ADMIN_ADJUSTMENT') => {
  const user = await User.findById(userId);
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found.');
  const before = user.credits;
  const after = Math.max(0, before + delta);
  user.credits = after;
  await user.save();
  await recordTx({ userId: user._id, type, amount: after - before, before, after, reason });
  return after;
};

/** Called when the plan changes so the balance matches the new plan immediately. */
export const applyPlanChange = async (userId: string, plan: 'free' | 'pro', reason: string) => {
  const cfg = await getPlan(plan);
  const user = await User.findById(userId);
  if (!user) return;
  const before = user.credits;
  user.plan = plan;
  user.credits = cfg.creditsPerPeriod;
  user.reservedCredits = 0;
  user.creditsResetAt = cfg.period === 'day' ? nextDailyReset() : addMonths(new Date(), 1);
  await user.save();
  await recordTx({
    userId: user._id, type: cfg.period === 'day' ? 'DAILY_RESET' : 'MONTHLY_GRANT',
    amount: cfg.creditsPerPeriod - before, before, after: cfg.creditsPerPeriod, reason,
  });
};