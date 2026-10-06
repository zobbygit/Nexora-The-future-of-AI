import rateLimit from 'express-rate-limit';
import { isTest } from '../config/env';

const make = (windowMs: number, limit: number, message: string) =>
  rateLimit({
    windowMs, limit, standardHeaders: 'draft-7', legacyHeaders: false, skip: () => isTest,
    handler: (_req, res) => { res.status(429).json({ error: { code: 'RATE_LIMITED', message } }); },
  });

export const globalLimiter = make(60_000, 300, 'Too many requests. Slow down a little.');
export const authLimiter = make(15 * 60_000, 30, 'Too many attempts. Try again in a few minutes.');
export const aiLimiter = make(60_000, 30, 'You are generating too quickly. Wait a moment and retry.');
export const uploadLimiter = make(60_000, 20, 'Too many uploads. Wait a moment and retry.');
