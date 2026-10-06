import { Router } from 'express';
import * as a from '../controllers/auth.controller';
import { requireAdmin, requireUser } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimit';
import { validateBody } from '../middleware/validate';

export const authRouter = Router();
authRouter.post('/register', authLimiter, validateBody(a.registerSchema), a.register);
authRouter.post('/login', authLimiter, validateBody(a.loginSchema), a.login);
authRouter.post('/refresh', a.refresh);
authRouter.post('/logout', a.logout);
authRouter.get('/me', requireUser, a.me);
authRouter.get('/socket-token', requireUser, a.socketToken);
authRouter.post('/forgot-password', authLimiter, validateBody(a.forgotSchema), a.forgotPassword);
authRouter.post('/reset-password', authLimiter, validateBody(a.resetSchema), a.resetPassword);
authRouter.post('/change-password', requireUser, validateBody(a.changePasswordSchema), a.changePassword);
authRouter.post('/recovery-code', requireUser, authLimiter, a.regenerateRecoveryCode);

export const adminAuthRouter = Router();
adminAuthRouter.post('/login', authLimiter, validateBody(a.adminLoginSchema), a.adminLogin);
adminAuthRouter.post('/logout', a.adminLogout);
adminAuthRouter.get('/me', requireAdmin, a.adminMe);
adminAuthRouter.get('/socket-token', requireAdmin, a.adminSocketToken);