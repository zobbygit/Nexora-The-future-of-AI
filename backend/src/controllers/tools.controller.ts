import { Request, Response } from 'express';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { z } from 'zod';
import { ToolId } from '../config/tools';
import { checkFile } from '../middleware/upload';
import { parseInput } from '../middleware/validate';
import { Artifact } from '../models/Artifact';
import { DocChunk, DocumentModel } from '../models/Document';
import { artifactDto } from '../services/artifact.service';
import { Collaboration } from '../models/Collaboration';
import { creditSnapshot, generationDto, runTool } from '../services/ai.service';
import { ensureFreshCredits } from '../services/credit.service';
import { adminEvent, notify } from '../services/notification.service';
import { ingestDocument } from '../services/rag.service';
import { deleteFile, saveFile } from '../services/storage.service';
import { getTools } from '../services/settings.service';
import { agentHandler, codeHandler, resumeHandler, writerHandler } from '../services/tools/text.tools';
import { pdfHandler } from '../services/tools/pdf.tool';
import { dataHandler } from '../services/tools/data.tool';
import { backgroundHandler, enhanceHandler, imageToTextHandler, sttHandler, textToImageHandler, ttsHandler, videoHandler } from '../services/tools/media.tools';
import * as S from '../services/tools/schemas';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError, badRequest, forbidden, notFound } from '../utils/errors';
import { safeFetchBuffer } from '../utils/ssrf';
import { AUDIO_MIMES, IMAGE_MIMES, VIDEO_MIMES, sniffMime } from '../utils/sniff';
import { logger } from '../utils/logger';

const respond = (res: Response, r: Awaited<ReturnType<typeof runTool>>) =>
  res.json({
    generation: generationDto(r.generation),
    artifact: r.artifact ? artifactDto(r.artifact) : null,
    creditsRemaining: r.creditsRemaining, creditCost: r.creditCost,
  });

const json = <T extends z.ZodTypeAny>(id: ToolId, schema: T, make: (input: z.infer<T>, req: Request) => Parameters<typeof runTool>[0]['handler']) =>
  asyncHandler(async (req, res) => {
    const input = parseInput(schema, req.body);
    respond(res, await runTool({ toolId: id, userId: req.userId!, input, handler: make(input, req) as any }));
  });

export const writer = json('writer', S.writerSchema, () => writerHandler as any);
export const resume = json('resume', S.resumeSchema, () => resumeHandler as any);
export const code = json('code', S.codeSchema, () => codeHandler as any);
export const agent = json('agent', S.agentSchema, (_i, req) => agentHandler(req.userId!) as any);
export const pdfAsk = json('pdf', S.pdfAskSchema, (_i, req) => pdfHandler(req.userId!) as any);
export const tts = json('tts', S.ttsSchema, () => ttsHandler as any);
export const textToImage = json('text-to-image', S.textToImageSchema, () => textToImageHandler as any);

const fileTool = (id: ToolId, allowed: string[], label: string, schema: z.ZodTypeAny, make: (f: ReturnType<typeof checkFile>, opts: any) => any) =>
  asyncHandler(async (req, res) => {
    const opts = parseInput(schema, req.body);
    const file = checkFile(req.file, allowed, label);
    respond(res, await runTool({ toolId: id, userId: req.userId!, input: {} as any, handler: make(file, opts) }));
  });

export const stt = fileTool('stt', AUDIO_MIMES, 'audio file', S.sttSchema, (f, o) => sttHandler(f, o));
export const videoToText = fileTool('video-to-text', VIDEO_MIMES, 'video', S.sttSchema, (f, o) => videoHandler(f, o));
export const backgroundRemove = fileTool('background-remover', IMAGE_MIMES, 'image', z.object({}).passthrough(), (f) => backgroundHandler(f));
export const enhance = fileTool('image-enhancer', IMAGE_MIMES, 'image', S.enhanceSchema, (f, o) => enhanceHandler(f, o));
export const dataAnalyze = asyncHandler(async (req, res) => {
  const question = String(req.body?.question || '').slice(0, 500);
  const file = req.file;
  if (!file) throw badRequest('Attach a CSV or JSON file first.', 'FILE_REQUIRED');
  if (!/\.(csv|tsv|json)$/i.test(file.originalname)) throw badRequest('Use a CSV, TSV or JSON file.', 'UNSUPPORTED_FILE_TYPE');
  if (sniffMime(file.buffer)) throw badRequest('That file does not look like a data file.', 'UNSUPPORTED_FILE_TYPE');
  const filename = file.originalname.replace(/[^\w.\- ]+/g, '_').slice(0, 100);
  respond(res, await runTool({ toolId: 'data-analyzer', userId: req.userId!, input: {} as any, handler: dataHandler({ buffer: file.buffer, filename }, question) }));
});

export const imageToText = asyncHandler(async (req, res) => {
  const opts = parseInput(S.imageToTextSchema, req.body);
  let file;
  if (opts.imageUrl && !req.file) {
    // Server-side fetch of a user URL: guarded against SSRF, size-capped and type-checked.
    const buf = await safeFetchBuffer(opts.imageUrl, 8 * 1024 * 1024);
    const mime = sniffMime(buf);
    if (!mime || !IMAGE_MIMES.includes(mime)) throw badRequest('That URL is not a supported image.', 'UNSUPPORTED_FILE_TYPE');
    file = { buffer: buf, mime, filename: new URL(opts.imageUrl).pathname.split('/').pop() || 'image', size: buf.length };
  } else file = checkFile(req.file, IMAGE_MIMES, 'image');
  respond(res, await runTool({ toolId: 'image-to-text', userId: req.userId!, input: {} as any, handler: imageToTextHandler(file, opts) }));
});

// ── PDF documents (RAG ingestion) ─────────────────────────
export const uploadPdf = asyncHandler(async (req: Request, res: Response) => {
  const f = checkFile(req.file, ['application/pdf'], 'PDF');
  const uid = req.userId!;
  const fresh = await ensureFreshCredits(uid);
  if (!fresh.isActive) throw forbidden('This account is deactivated.', 'ACCOUNT_DEACTIVATED');
  const count = await DocumentModel.countDocuments({ ownerId: uid });
  if (count >= 50) throw badRequest('You have reached the 50 document limit. Delete one first.', 'DOCUMENT_LIMIT');

  const pages: string[] = [];
  let parsed;
  try {
    parsed = await pdfParse(f.buffer, {
      max: 300,
      pagerender: async (page: any) => {
        const tc = await page.getTextContent();
        let last: number | undefined, text = '';
        for (const it of tc.items) { text += (last !== undefined && last !== it.transform[5] ? '\n' : '') + it.str; last = it.transform[5]; }
        pages.push(text);
        return text;
      },
    });
  } catch (e) {
    logger.warn('pdf parse failed', { err: (e as Error).message });
    throw badRequest('We could not read that PDF. It may be encrypted or corrupted.', 'PDF_UNREADABLE');
  }
  if (!pages.some((p) => p.trim().length > 20)) throw badRequest('That PDF has no selectable text (scanned PDFs are not supported yet).', 'PDF_NO_TEXT');

  const stored = await saveFile(f.buffer, { folder: 'pdf', mime: 'application/pdf', ownerId: uid });
  const artifact = await Artifact.create({
    ownerId: uid, title: f.filename, kind: 'pdf', tool: 'pdf', mimeType: 'application/pdf', url: stored.url,
    storage: { provider: stored.provider, key: stored.key }, size: stored.size, source: 'upload', meta: { pages: parsed.numpages },
  });
  const doc = await DocumentModel.create({ ownerId: uid, artifactId: artifact._id, name: f.filename, pages: parsed.numpages, embedder: 'local', status: 'processing' });
  try {
    const r = await ingestDocument({ ownerId: uid, documentId: doc._id, pages });
    void notify(uid, 'processing', 'Document ready', `${f.filename} is ready for questions.`, '/app/tools/pdf');
    adminEvent('document', { userId: uid, chunks: r.chunkCount });
  } catch (e) {
    await DocumentModel.updateOne({ _id: doc._id }, { status: 'failed', error: (e as Error).message });
    await DocChunk.deleteMany({ documentId: doc._id });
    throw new AppError(422, 'DOCUMENT_FAILED', (e as Error).message || 'Processing failed.');
  }
  const ready = await DocumentModel.findById(doc._id).lean();
  res.status(201).json({ document: docDto(ready), artifact: artifactDto(artifact) });
});

const docDto = (d: any) => ({ id: String(d._id), name: d.name, pages: d.pages, chunkCount: d.chunkCount, status: d.status, artifactId: d.artifactId ? String(d.artifactId) : undefined, createdAt: d.createdAt });

export const listDocuments = asyncHandler(async (req, res) => {
  const own = await DocumentModel.find({ ownerId: req.userId }).sort({ createdAt: -1 }).limit(50).lean();
  const sharedIds = (await Collaboration.find({ collaboratorId: req.userId }).select('artifactId').lean()).map((c) => c.artifactId);
  const shared = sharedIds.length ? await DocumentModel.find({ artifactId: { $in: sharedIds }, status: 'ready' }).sort({ createdAt: -1 }).limit(20).lean() : [];
  res.json({ documents: [...own.map((d) => ({ ...docDto(d), shared: false })), ...shared.map((d) => ({ ...docDto(d), shared: true }))] });
});

export const deleteDocument = asyncHandler(async (req, res) => {
  const doc = await DocumentModel.findOne({ _id: req.params.id, ownerId: req.userId });
  if (!doc) throw notFound('Document not found.');
  await DocChunk.deleteMany({ documentId: doc._id });
  const art = doc.artifactId ? await Artifact.findOneAndDelete({ _id: doc.artifactId, ownerId: req.userId }) : null;
  if (art) await deleteFile(art.storage as any, art.mimeType || undefined);
  await doc.deleteOne();
  res.json({ ok: true });
});

export const catalog = asyncHandler(async (req, res) => {
  const [tools, snap] = await Promise.all([getTools(), creditSnapshot(req.userId!)]);
  res.json({
    plan: snap.plan, credits: snap.credits,
    tools: tools.map((t) => ({ id: t.id, name: t.name, category: t.category, plan: t.plan, credits: t.credits, enabled: t.enabled, locked: t.plan === 'pro' && snap.plan !== 'pro' })),
  });
});
