import { Router } from 'express';
import * as u from '../controllers/user.controller';
import * as a from '../controllers/artifact.controller';
import { requireUser } from '../middleware/auth';
import { uploadLimiter } from '../middleware/rateLimit';
import { upload } from '../middleware/upload';
import { validateBody } from '../middleware/validate';

const r = Router();
r.use(requireUser);

r.get('/bootstrap', u.bootstrap);
r.get('/dashboard', u.dashboard);
r.get('/credits', u.credits);
r.get('/search', u.search);
r.patch('/profile', validateBody(u.profileSchema), u.updateProfile);
r.post('/profile/avatar', uploadLimiter, upload(4).single('file'), u.uploadAvatar);
r.post('/onboarding', validateBody(u.onboardingSchema), u.completeOnboarding);
r.delete('/account', u.deleteAccount);

r.get('/artifacts', a.listArtifacts);
r.post('/artifacts/upload', uploadLimiter, upload(25).single('file'), a.uploadFile);
r.get('/artifacts/:id', a.getArtifact);
r.patch('/artifacts/:id', a.updateArtifact);
r.delete('/artifacts/:id', a.deleteArtifact);
r.get('/artifacts/:id/export/pdf', a.exportArtifactPdf);
r.post('/artifacts/:id/downloaded', a.downloadCompleted);

r.get('/history', a.listHistory);
r.get('/history/export/:format(pdf|json)', a.exportHistory);
r.get('/history/:id', a.getGeneration);
r.patch('/history/:id/favorite', a.favoriteGeneration);
r.delete('/history/:id', a.deleteGeneration);

r.get('/collaboration', a.collabOverview);
r.get('/collaboration/users', a.searchUsers);
r.post('/collaboration', a.shareArtifact);
r.get('/collaboration/artifact/:artifactId', a.listCollaborators);
r.patch('/collaboration/:id', a.updateCollaboration);
r.delete('/collaboration/:id', a.revokeCollaboration);

r.get('/notifications', a.listNotifications);
r.post('/notifications/read-all', a.markAllRead);
r.post('/notifications/:id/read', a.markRead);
r.delete('/notifications/:id', a.deleteNotification);

export default r;
