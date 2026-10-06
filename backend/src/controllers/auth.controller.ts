import bcrypt from 'bcryptjs';
import { Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../config/env';
import { User, publicUser } from '../models/User';
import { ensureFreshCredits } from '../services/credit.service';
import { getSystem } from '../services/settings.service';
import { notify } from '../services/notification.service';
import { adminEvent } from '../services/notification.service';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError, conflict, forbidden, unauthorized } from '../utils/errors';
import {
  COOKIES, clearAdminCookie, clearUserCookies, generateRecoveryCode, normalizeRecoveryCode, safeEqual, setAdminCookie,
  setUserCookies, signResetToken, signSocketToken, verifyRefresh, verifyReset,
} from '../utils/tokens';

export const passwordSchema = z
  .string().min(8, 'Use at least 8 characters').max(72)
  .regex(/[A-Za-z]/, 'Include at least one letter').regex(/\d/, 'Include at least one number');

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  phone: z.string().trim().max(20).optional().default(''),
  password: passwordSchema,
});
export const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(72) });
export const forgotSchema = z.object({ email: z.string().trim().toLowerCase().email(), recoveryCode: z.string().min(8).max(40) });
export const resetSchema = z.object({ resetToken: z.string().min(10), password: passwordSchema });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1), newPassword: passwordSchema });
export const adminLoginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(200) });

const ROUNDS = 12;
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60_000;

export const register = asyncHandler(async (req: Request, res: Response) => {
  if (!(await getSystem()).registrationEnabled) throw forbidden('Sign-ups are temporarily closed.', 'REGISTRATION_CLOSED');
  const { name, email, phone, password } = req.body as z.infer<typeof registerSchema>;
  if (email === env.ADMIN_EMAIL.toLowerCase()) throw conflict('That email is already in use.', 'EMAIL_TAKEN');
  if (await User.exists({ email })) throw conflict('That email is already in use.', 'EMAIL_TAKEN');

  const recoveryCode = generateRecoveryCode();
  const user = await User.create({
    name, email, phone,
    passwordHash: await bcrypt.hash(password, ROUNDS),
    recoveryCodeHash: await bcrypt.hash(normalizeRecoveryCode(recoveryCode), 10),
  });
  await ensureFreshCredits(user._id);
  setUserCookies(res, String(user._id), user.tokenVersion);
  void notify(user._id, 'system', 'Welcome to Nexora', 'Your workspace is ready. Pick a tool to get started.', '/app/tools');
  adminEvent('registration', { userId: String(user._id), name });
  const fresh = await User.findById(user._id);
  // The recovery code is shown exactly once — only its hash is stored.
  res.status(201).json({ user: publicUser(fresh), recoveryCode });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as z.infer<typeof loginSchema>;
  const user = await User.findOne({ email }).select('+passwordHash');
  const invalid = new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  if (!user) { await bcrypt.compare(password, '$2a$12$C6UzMDM.H6dfI/f/IKcEeO5G5yqB0xq1b0Z6M5oZ4tX2r9mXcS8yO'); throw invalid; }
  if (user.lockUntil && user.lockUntil > new Date()) {
    throw new AppError(429, 'ACCOUNT_LOCKED', 'Too many failed attempts. Try again in a few minutes.');
  }
  if (!(await bcrypt.compare(password, user.passwordHash))) {
    user.failedLogins += 1;
    if (user.failedLogins >= MAX_FAILS) { user.lockUntil = new Date(Date.now() + LOCK_MS); user.failedLogins = 0; }
    await user.save();
    throw invalid;
  }
  if (!user.isActive) throw forbidden('This account has been deactivated. Contact support.', 'ACCOUNT_DEACTIVATED');
  user.failedLogins = 0; user.lockUntil = undefined; user.lastActiveAt = new Date();
  await user.save();
  setUserCookies(res, String(user._id), user.tokenVersion);
  await ensureFreshCredits(user._id);
  res.json({ user: publicUser(await User.findById(user._id)) });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[COOKIES.refresh];
  if (!token) throw unauthorized();
  let payload;
  try { payload = verifyRefresh(token); } catch { throw unauthorized('Your session expired. Please sign in again.', 'SESSION_EXPIRED'); }
  const user = await User.findById(payload.sub);
  if (!user || user.tokenVersion !== payload.tv || !user.isActive) throw unauthorized('Your session is no longer valid.', 'SESSION_REVOKED');
  setUserCookies(res, String(user._id), user.tokenVersion);
  res.json({ ok: true });
});

export const logout = asyncHandler(async (_req: Request, res: Response) => {
  clearUserCookies(res);
  res.json({ ok: true });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  await ensureFreshCredits(req.userId!);
  const user = await User.findById(req.userId);
  if (!user) throw unauthorized();
  res.json({ user: publicUser(user) });
});

/** Short-lived ticket so Socket.IO can authenticate even when the browser blocks third-party cookies. */
export const socketToken = asyncHandler(async (req: Request, res: Response) => {
  res.json({ token: signSocketToken(req.userId!, 'user') });
});
export const adminSocketToken = (_req: Request, res: Response) => res.json({ token: signSocketToken('admin', 'admin') });

/**
 * Account recovery without email: the user proves ownership with the one-time recovery code shown at sign-up,
 * receives a short-lived reset token, then sets a new password (which also issues a fresh recovery code).
 */
export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email, recoveryCode } = req.body as z.infer<typeof forgotSchema>;
  const user = await User.findOne({ email }).select('+recoveryCodeHash');
  const ok = !!user?.recoveryCodeHash && (await bcrypt.compare(normalizeRecoveryCode(recoveryCode), user.recoveryCodeHash));
  if (!user || !ok) throw new AppError(400, 'RECOVERY_FAILED', 'That email and recovery code do not match.');
  res.json({ resetToken: signResetToken(String(user._id), user.tokenVersion) });
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { resetToken, password } = req.body as z.infer<typeof resetSchema>;
  let payload;
  try { payload = verifyReset(resetToken); } catch { throw new AppError(400, 'RESET_EXPIRED', 'This reset link expired. Start again.'); }
  if (payload.purpose !== 'reset') throw new AppError(400, 'RESET_INVALID', 'Invalid reset request.');
  const user = await User.findById(payload.sub).select('+passwordHash +recoveryCodeHash');
  if (!user || user.tokenVersion !== payload.tv) throw new AppError(400, 'RESET_EXPIRED', 'This reset link expired. Start again.');
  const newCode = generateRecoveryCode();
  user.passwordHash = await bcrypt.hash(password, ROUNDS);
  user.recoveryCodeHash = await bcrypt.hash(normalizeRecoveryCode(newCode), 10);
  user.tokenVersion += 1; // revokes every existing session
  user.failedLogins = 0; user.lockUntil = undefined;
  await user.save();
  clearUserCookies(res);
  res.json({ ok: true, recoveryCode: newCode });
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body as z.infer<typeof changePasswordSchema>;
  const user = await User.findById(req.userId).select('+passwordHash');
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) throw new AppError(400, 'WRONG_PASSWORD', 'Your current password is incorrect.');
  user.passwordHash = await bcrypt.hash(newPassword, ROUNDS);
  user.tokenVersion += 1;
  await user.save();
  setUserCookies(res, String(user._id), user.tokenVersion);
  res.json({ ok: true });
});

export const regenerateRecoveryCode = asyncHandler(async (req: Request, res: Response) => {
  const { password } = z.object({ password: z.string().min(1) }).parse(req.body);
  const user = await User.findById(req.userId).select('+passwordHash +recoveryCodeHash');
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw new AppError(400, 'WRONG_PASSWORD', 'Your password is incorrect.');
  const code = generateRecoveryCode();
  user.recoveryCodeHash = await bcrypt.hash(normalizeRecoveryCode(code), 10);
  await user.save();
  res.json({ recoveryCode: code });
});

// ── Admin ────────────────────────────────────────────────
export const adminLogin = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as z.infer<typeof adminLoginSchema>;
  const okEmail = safeEqual(email, env.ADMIN_EMAIL.toLowerCase());
  const okPass = safeEqual(password, env.ADMIN_PASSWORD);
  if (!(okEmail && okPass)) throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  setAdminCookie(res);
  res.json({ admin: { email: env.ADMIN_EMAIL, name: 'Administrator' } });
});
export const adminLogout = (_req: Request, res: Response) => { clearAdminCookie(res); res.json({ ok: true }); };
export const adminMe = (_req: Request, res: Response) => res.json({ admin: { email: env.ADMIN_EMAIL, name: 'Administrator' } });