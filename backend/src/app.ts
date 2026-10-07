import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Express, Request, Response } from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { allowedOrigins, env, isProd } from './config/env';
import * as billing from './controllers/billing.controller';
import { serveFile } from './controllers/artifact.controller';
import { csrfGuard, requireUser } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { globalLimiter } from './middleware/rateLimit';
import adminRoutes from './routes/admin.routes';
import { adminAuthRouter, authRouter } from './routes/auth.routes';
import { billingRouter, supportRouter } from './routes/support.routes';
import toolRoutes from './routes/tools.routes';
import userRoutes from './routes/user.routes';
import { getSystem } from './services/settings.service';
import { mongoSanitize } from './utils/sanitize';
import { COOKIES } from './utils/tokens';

export const createApp = (): Express => {
  const app = express();
  app.set('trust proxy', env.TRUST_PROXY);
  app.disable('x-powered-by');

  // Force HTTPS behind the platform proxy in production.
  if (isProd) {
    app.use((req, res, next) => {
      if (req.secure || req.headers['x-forwarded-proto'] === 'https' || req.path === '/health') return next();
      res.redirect(308, `https://${req.headers.host}${req.originalUrl}`);
    });
  }

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, hsts: isProd ? undefined : false }));
  app.use(cors({
    origin: (origin, cb) => (!origin || allowedOrigins().includes(origin) ? cb(null, true) : cb(new Error('Not allowed by CORS'))),
    credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], allowedHeaders: ['Content-Type', 'X-Nexora-Client'], maxAge: 7200,
  }));
  app.use(compression());

  app.get('/health', (_req: Request, res: Response) => {
    const db = mongoose.connection.readyState === 1;
    res.status(db ? 200 : 503).json({ status: db ? 'ok' : 'degraded', db, uptime: Math.round(process.uptime()), time: new Date().toISOString() });
  });

  // Stripe needs the raw body for signature verification — mounted BEFORE express.json().
  app.post('/api/billing/webhook', express.raw({ type: 'application/json', limit: '1mb' }), billing.webhook);

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(mongoSanitize);
  app.use('/api', globalLimiter, csrfGuard);

  // Maintenance mode blocks everything except admin + auth + health.
  app.use('/api', async (req, res, next) => {
    if (req.path.startsWith('/admin') || req.path.startsWith('/auth') || req.path.startsWith('/billing/webhook')) return next();
    if ((await getSystem().catch(() => null))?.maintenanceMode && !req.cookies?.[COOKIES.admin]) {
      return res.status(503).json({ error: { code: 'MAINTENANCE', message: 'Nexora is briefly down for maintenance. Please check back soon.' } });
    }
    next();
  });

  app.use('/api/auth', authRouter);
  app.use('/api/admin/auth', adminAuthRouter);
  app.use('/api/admin', adminRoutes);
  app.use('/api/tools', toolRoutes);
  app.use('/api/billing', billingRouter);
  app.use('/api/support', supportRouter);
  app.get('/api/files/*', requireUser, serveFile);
  app.use('/api', userRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};