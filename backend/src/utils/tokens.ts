import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { CookieOptions, Response } from 'express';
import { env, isProd } from '../config/env';

export type Role = 'user' | 'admin';
export interface AccessPayload {
  sub: string;
  role: Role;
  tv?: number;
}

export const COOKIES = { access: 'nx_at', refresh: 'nx_rt', admin: 'nx_admin' } as const;

/**
 * SameSite policy. When the app (e.g. localhost or vercel.app) and the API (onrender.com) are different sites,
 * the browser only attaches the cookie to API calls if it is SameSite=None; Secure. "lax" would make every
 * request after login come back 401 — so in production "lax"/"strict" are honoured ONLY when COOKIE_DOMAIN
 * is set (i.e. app and API genuinely share a registrable domain). Otherwise we force "none".
 */
export const resolveSameSite = (prod: boolean, cookieDomain: string, configured: string): 'none' | 'lax' | 'strict' => {
  if (!prod) return (configured as 'none' | 'lax' | 'strict') || 'lax';
  if (!cookieDomain) return 'none';
  return (configured as 'none' | 'lax' | 'strict') || 'lax';
};

const base = (): CookieOptions => ({
  httpOnly: true,
  secure: isProd,
  sameSite: resolveSameSite(isProd, env.COOKIE_DOMAIN, env.COOKIE_SAMESITE),
  ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
});

export const signAccess = (sub: string, tv: number) =>
  jwt.sign({ sub, role: 'user', tv } satisfies AccessPayload, env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
export const signRefresh = (sub: string, tv: number) =>
  jwt.sign({ sub, role: 'user', tv } satisfies AccessPayload, env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
export const signAdmin = () =>
  jwt.sign({ sub: 'admin', role: 'admin' } satisfies AccessPayload, env.JWT_ACCESS_SECRET, { expiresIn: '2h' });
export const signResetToken = (sub: string, tv: number) =>
  jwt.sign({ sub, purpose: 'reset', tv }, env.JWT_ACCESS_SECRET, { expiresIn: '10m' });

export const signSocketToken = (sub: string, role: Role) => jwt.sign({ sub, role, purpose: 'socket' }, env.JWT_ACCESS_SECRET, { expiresIn: '90s' });
export const verifySocketToken = (token: string) => {
  const p = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessPayload & { purpose?: string };
  if (p.purpose !== 'socket') throw new Error('wrong token purpose');
  return p;
};

export const verifyAccess = (token: string) => jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessPayload;
export const verifyRefresh = (token: string) => jwt.verify(token, env.JWT_REFRESH_SECRET) as AccessPayload;
export const verifyReset = (token: string) =>
  jwt.verify(token, env.JWT_ACCESS_SECRET) as { sub: string; purpose: string; tv: number };

export const setUserCookies = (res: Response, userId: string, tokenVersion: number) => {
  res.cookie(COOKIES.access, signAccess(userId, tokenVersion), { ...base(), maxAge: 15 * 60 * 1000, path: '/' });
  res.cookie(COOKIES.refresh, signRefresh(userId, tokenVersion), {
    ...base(),
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/auth',
  });
};
export const clearUserCookies = (res: Response) => {
  res.clearCookie(COOKIES.access, { ...base(), path: '/' });
  res.clearCookie(COOKIES.refresh, { ...base(), path: '/api/auth' });
};
export const setAdminCookie = (res: Response) =>
  res.cookie(COOKIES.admin, signAdmin(), { ...base(), maxAge: 2 * 60 * 60 * 1000, path: '/' });
export const clearAdminCookie = (res: Response) => res.clearCookie(COOKIES.admin, { ...base(), path: '/' });

export const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex');
export const safeEqual = (a: string, b: string) => {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
};

/** Human-friendly one-time recovery code, e.g. K7QM-2XPA-9FDT-LW4H */
export const generateRecoveryCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(16);
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]);
  return [0, 4, 8, 12].map((i) => chars.slice(i, i + 4).join('')).join('-');
};
export const normalizeRecoveryCode = (c: string) => c.replace(/[^A-Za-z0-9]/g, '').toUpperCase();