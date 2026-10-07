import { Router } from 'express';
import * as s from '../controllers/support.controller';
import * as b from '../controllers/billing.controller';
import { requireUser } from '../middleware/auth';
import { uploadLimiter } from '../middleware/rateLimit';
import { upload } from '../middleware/upload';

export const supportRouter = Router();
supportRouter.use(requireUser);
supportRouter.get('/chat', s.chatHistory);
supportRouter.delete('/chat', s.deleteChat);
supportRouter.delete('/chat/:id', s.deleteMessage);
supportRouter.get('/reports', s.listReports);
supportRouter.post('/reports', uploadLimiter, upload(5, 3).array('files', 3), s.createReport);
supportRouter.get('/reports/:id', s.getReport);
supportRouter.post('/reports/:id/reply', s.replyReport);
supportRouter.post('/reports/:id/status', s.setReportStatus);

export const billingRouter = Router();
billingRouter.use(requireUser);
billingRouter.get('/', b.overview);
billingRouter.post('/checkout', b.checkout);
billingRouter.post('/sync', b.sync);
billingRouter.post('/portal', b.portal);
billingRouter.post('/cancel', b.cancel);
billingRouter.post('/resume', b.resume);