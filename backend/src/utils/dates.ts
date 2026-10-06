import { env } from '../config/env';

/** Next reset boundary (midnight in the configured UTC offset) strictly after `now`. */
export const nextDailyReset = (now: Date = new Date(), offsetMin = env.CREDIT_RESET_OFFSET_MINUTES): Date => {
  const shifted = new Date(now.getTime() + offsetMin * 60000);
  const midnightShifted = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() + 1);
  return new Date(midnightShifted - offsetMin * 60000);
};

export const addMonths = (d: Date, n: number): Date => {
  const r = new Date(d);
  r.setUTCMonth(r.getUTCMonth() + n);
  return r;
};

export const startOfDayUtc = (d: Date = new Date()) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
export const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);
