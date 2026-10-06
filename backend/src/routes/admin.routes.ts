import { Router } from 'express';
import * as a from '../controllers/admin.controller';
import { requireAdmin } from '../middleware/auth';

const r = Router();
r.use(requireAdmin);
r.get('/dashboard', a.dashboard);
r.get('/search', a.globalSearch);

r.get('/users', a.listUsers);
r.get('/users/:id', a.userDetail);
r.post('/users/:id/active', a.setUserActive);
r.post('/users/:id/credits', a.userCredits);
r.post('/users/:id/plan', a.userPlan);
r.delete('/users/:id', a.deleteUser);

r.get('/ai', a.aiOverview);
r.get('/generations', a.listGenerations);
r.get('/generations/:id', a.getGeneration);

r.get('/billing', a.billingOverview);
r.get('/plans', a.getPlansConfig);
r.put('/plans', a.updatePlansConfig);
r.get('/transactions', a.transactions);

r.get('/support/reports', a.listReports);
r.get('/support/reports/:id', a.getReport);
r.post('/support/reports/:id/reply', a.replyReport);
r.post('/support/reports/:id/status', a.setReportStatus);
r.get('/support/conversations', a.conversations);
r.get('/support/conversations/:userId', a.conversationMessages);
r.get('/support/users', a.chatUsers);

r.get('/communication/announcements', a.listAnnouncements);
r.post('/communication/announcements', a.createAnnouncement);
r.patch('/communication/announcements/:id', a.updateAnnouncement);
r.delete('/communication/announcements/:id', a.deleteAnnouncement);
r.get('/communication/notifications', a.notificationStats);
r.post('/communication/notifications', a.sendSystemNotification);

r.get('/analytics', a.analytics);
r.get('/analytics/export/pdf', a.analyticsPdf);

r.get('/system', a.systemOverview);
r.put('/system/settings', a.updateSystem);
r.get('/system/audit', a.auditLogs);
r.get('/system/audit/export/:format(pdf|json)', a.exportAudit);

export default r;
