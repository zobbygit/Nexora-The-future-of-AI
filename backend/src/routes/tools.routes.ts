import { Router } from 'express';
import * as c from '../controllers/tools.controller';
import { requireUser } from '../middleware/auth';
import { aiLimiter, uploadLimiter } from '../middleware/rateLimit';
import { upload } from '../middleware/upload';

const r = Router();
r.use(requireUser);
r.get('/', c.catalog);

r.post('/writer', aiLimiter, c.writer);
r.post('/resume', aiLimiter, c.resume);
r.post('/code', aiLimiter, c.code);
r.post('/agent', aiLimiter, c.agent);
r.post('/tts', aiLimiter, c.tts);
r.post('/text-to-image', aiLimiter, c.textToImage);

r.post('/stt', aiLimiter, uploadLimiter, upload(25).single('file'), c.stt);
r.post('/video-to-text', aiLimiter, uploadLimiter, upload(25).single('file'), c.videoToText);
r.post('/image-to-text', aiLimiter, uploadLimiter, upload(8).single('file'), c.imageToText);
r.post('/background-remover', aiLimiter, uploadLimiter, upload(8).single('file'), c.backgroundRemove);
r.post('/image-enhancer', aiLimiter, uploadLimiter, upload(8).single('file'), c.enhance);
r.post('/data-analyzer', aiLimiter, uploadLimiter, upload(10).single('file'), c.dataAnalyze);

r.get('/pdf/documents', c.listDocuments);
r.post('/pdf/documents', uploadLimiter, upload(15).single('file'), c.uploadPdf);
r.delete('/pdf/documents/:id', c.deleteDocument);
r.post('/pdf/ask', aiLimiter, c.pdfAsk);

export default r;
