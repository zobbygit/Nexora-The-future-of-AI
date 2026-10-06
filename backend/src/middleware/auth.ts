import { NextFunction, Request, Response } from 'express';
import { User } from '../models/User';
import { COOKIES, verifyAccess } from '../utils/tokens';
import { AppError, forbidden, unauthorized } from '../utils/errors';
import { asyncHandler } from '../utils/asyncHandler';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
      user?: any;
      isAdmin?: boolean;
    }
  }
}

/** Requires a valid user session. Loads the user so deactivation and token revocation take effect immediately. */
export const requireUser = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const token = req.cookies?.[COOKIES.access];
  if (!token) throw unauthorized();
  let payload;
  try {
    payload = verifyAccess(token);
  } catch (e) {
    const expired = (e as Error).name === 'TokenExpiredError';
    throw new AppError(401, expired ? 'TOKEN_EXPIRED' : 'UNAUTHORIZED', expired ? 'Your session expired.' : 'Please sign in to continue.');
  }
  if (payload.role !== 'user') throw unauthorized();
  const user = await User.findById(payload.sub);
  if (!user || user.tokenVersion !== payload.tv) throw unauthorized('Your session is no longer valid. Please sign in again.', 'SESSION_REVOKED');
  if (!user.isActive) throw forbidden('This account has been deactivated. Contact support.', 'ACCOUNT_DEACTIVATED');
  req.userId = String(user._id);
  req.user = user;
  next();
});

export const requireAdmin = (req: Request, _res: Response, next: NextFunction) => {
  const token = req.cookies?.[COOKIES.admin];
  if (!token) return next(unauthorized('Admin sign-in required.', 'ADMIN_UNAUTHORIZED'));
  try {
    const p = verifyAccess(token);
    if (p.role !== 'admin') throw new Error('not admin');
    req.isAdmin = true;
    next();
  } catch {
    next(unauthorized('Admin session expired.', 'ADMIN_UNAUTHORIZED'));
  }
};

/**
 * Cookies are SameSite=None in production (cross-site SPA + API), so state-changing requests must carry a
 * custom header. Browsers only send it after a CORS preflight, which our origin allow-list controls.
 */
export const csrfGuard = (req: Request, _res: Response, next: NextFunction) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.path === '/billing/webhook' || req.originalUrl.startsWith('/api/billing/webhook')) return next();
  if (req.headers['x-nexora-client'] !== 'web') return next(forbidden('Missing client header.', 'CSRF_BLOCKED'));
  next();
};