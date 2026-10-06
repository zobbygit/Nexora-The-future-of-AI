import { Types } from 'mongoose';
import { env } from '../config/env';
import { Collaboration } from '../models/Collaboration';
import { DocChunk, DocumentModel } from '../models/Document';
import { notFound } from '../utils/errors';
import { logger } from '../utils/logger';
import { routeRequest } from './providerRouter';
import { localEmbed } from './providers/mock';
import type { ProviderName } from '../config/tools';

export interface RawChunk { page: number; section: string; text: string }
export interface Citation { page: number; section: string; snippet: string; score: number }

const TARGET = 900;
const OVERLAP = 150;

/** Splits per-page text into overlapping, sentence-aware chunks that keep their page number. */
export const chunkPages = (pages: string[]): RawChunk[] => {
  const out: RawChunk[] = [];
  pages.forEach((raw, i) => {
    const text = raw.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    if (!text) return;
    const paras = text.split(/\n{2,}/);
    let buf = '';
    const flush = () => {
      const t = buf.trim();
      if (t.length > 40) out.push({ page: i + 1, section: (t.split('\n')[0] || '').slice(0, 80), text: t });
      buf = buf.length > OVERLAP ? buf.slice(-OVERLAP) : '';
    };
    for (const p of paras) {
      if (buf.length + p.length > TARGET && buf) flush();
      if (p.length > TARGET) {
        const sentences = p.match(/[^.!?\n]+[.!?]?\s*/g) || [p];
        for (const s of sentences) {
          if (buf.length + s.length > TARGET && buf) flush();
          buf += s;
        }
      } else buf += (buf ? '\n\n' : '') + p;
    }
    if (buf.trim().length > 40) out.push({ page: i + 1, section: (buf.trim().split('\n')[0] || '').slice(0, 80), text: buf.trim() });
  });
  return out;
};

export const cosine = (a: number[], b: number[]): number => {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
};

type Embedder = 'huggingface' | 'cloudflare' | 'local';
export interface Embedded { vectors: number[][]; embedder: Embedder; model: string }
export interface EmbedPin { embedder: Embedder; model?: string }

/**
 * Embeds with a live provider model when available, otherwise a deterministic local embedder. The model is chosen
 * dynamically, so each document remembers WHICH model embedded it and every later query is pinned to that same
 * model — mixing vector spaces would silently ruin retrieval.
 */
export const embedTexts = async (texts: string[], pin?: EmbedPin): Promise<Embedded> => {
  const local = (): Embedded => ({ vectors: texts.map((t) => localEmbed(t)), embedder: 'local', model: 'local-hash' });
  if (pin?.embedder === 'local') return local();
  const order: Embedder[] = pin ? [pin.embedder] : ['huggingface', 'cloudflare', 'local'];
  for (const e of order) {
    if (e === 'local') return local();
    try {
      const out = await routeRequest('embeddings', [e as ProviderName], { text: texts, options: pin?.model ? { model: pin.model } : undefined });
      if (out.result.embeddings?.length === texts.length) return { vectors: out.result.embeddings, embedder: e, model: out.result.model };
    } catch (err) {
      logger.warn('embedder unavailable', { embedder: e, err: (err as Error).message });
      if (pin) throw err; // a pinned model must not be silently swapped
    }
  }
  return local();
};

export const ingestDocument = async (opts: { ownerId: string; documentId: Types.ObjectId; pages: string[] }) => {
  const chunks = chunkPages(opts.pages);
  if (!chunks.length) throw new Error('No readable text found in this PDF.');
  const BATCH = 32;
  const embedAll = async (forceLocal: boolean) => {
    let pin: EmbedPin | undefined = forceLocal ? { embedder: 'local' } : undefined;
    let meta: Embedded | undefined;
    const vectors: number[][] = [];
    for (let i = 0; i < chunks.length; i += BATCH) {
      const r = await embedTexts(chunks.slice(i, i + BATCH).map((c) => c.text), pin);
      meta ||= r;
      pin ||= { embedder: r.embedder, model: r.model };
      vectors.push(...r.vectors);
    }
    return { vectors, embedder: meta!.embedder, model: meta!.model };
  };
  let result;
  try { result = await embedAll(false); } catch (e) { logger.warn('embedding failed mid-document, re-embedding locally', { err: (e as Error).message }); result = await embedAll(true); }
  await DocChunk.insertMany(
    chunks.map((c, i) => ({ documentId: opts.documentId, ownerId: opts.ownerId, index: i, page: c.page, section: c.section, text: c.text, embedding: result.vectors[i] })),
  );
  await DocumentModel.updateOne(
    { _id: opts.documentId },
    { status: 'ready', chunkCount: chunks.length, embedder: result.embedder, embeddingModel: result.model, dims: result.vectors[0]?.length, charCount: chunks.reduce((a, c) => a + c.text.length, 0) },
  );
  return { chunkCount: chunks.length, embedder: result.embedder, model: result.model };
};

/** Last-resort ranking when the document's embedding model cannot be reached: plain term overlap. */
export const keywordRank = <T extends { text: string }>(query: string, chunks: T[]): Array<T & { score: number }> => {
  const terms = [...new Set((query.toLowerCase().match(/[a-z0-9]{3,}/g) || []))];
  return chunks
    .map((c) => {
      const t = c.text.toLowerCase();
      const hits = terms.reduce((a, term) => a + (t.split(term).length - 1), 0);
      return { ...c, score: hits / Math.sqrt(t.length / 200 + 1) };
    })
    .sort((a, b) => b.score - a.score);
};

/**
 * Retrieves the most relevant chunks for a query. Uses MongoDB Atlas Vector Search when enabled and
 * falls back to in-app cosine ranking (exact, and fast for single-document scopes).
 * Always scoped to the requesting owner — users can only retrieve their own documents.
 */
/** A document is readable by its owner, or by anyone the owning artifact has been shared with. */
export const authorizedDocument = async (documentId: string, userId: string) => {
  if (!Types.ObjectId.isValid(documentId)) throw notFound('Document not found.');
  const doc = await DocumentModel.findById(documentId);
  if (!doc) throw notFound('Document not found.');
  if (String(doc.ownerId) === userId) return doc;
  const shared = doc.artifactId && (await Collaboration.exists({ artifactId: doc.artifactId, collaboratorId: userId }));
  if (!shared) throw notFound('Document not found.');
  return doc;
};

export const retrieve = async (opts: { ownerId: string; documentId: string; query: string; k?: number }): Promise<Citation[]> => {
  const doc = await authorizedDocument(opts.documentId, opts.ownerId);
  if (doc.status !== 'ready') throw notFound('This document is still processing.', 'DOCUMENT_NOT_READY');
  const k = opts.k ?? 6;
  let qv: number[] | null = null;
  try {
    qv = (await embedTexts([opts.query], { embedder: doc.embedder as Embedder, model: (doc as any).embeddingModel || undefined })).vectors[0];
  } catch {
    qv = null; // the document's embedding model is unreachable right now → keyword ranking below
  }
  if (!qv) {
    const all = await DocChunk.find({ documentId: doc._id }).select('page section text').lean();
    return keywordRank(opts.query, all.map((c) => ({ page: c.page as number, section: c.section as string, text: c.text as string })))
      .slice(0, k).map((c) => ({ page: c.page, section: c.section, snippet: c.text, score: Number(c.score.toFixed(4)) }));
  }

  if (env.ATLAS_VECTOR_SEARCH) {
    try {
      const rows = await DocChunk.aggregate([
        { $vectorSearch: {
          index: env.ATLAS_VECTOR_INDEX, path: 'embedding', queryVector: qv!, numCandidates: Math.max(100, k * 20), limit: k,
          filter: { documentId: doc._id },
        } },
        { $project: { page: 1, section: 1, text: 1, score: { $meta: 'vectorSearchScore' } } },
      ]);
      if (rows.length) return rows.map((r) => ({ page: r.page, section: r.section, snippet: r.text, score: Number(r.score.toFixed(4)) }));
    } catch (e) {
      logger.warn('atlas vector search failed, using cosine fallback', { err: (e as Error).message });
    }
  }

  const chunks = await DocChunk.find({ documentId: doc._id }).select('+embedding page section text').lean();
  return chunks
    .map((c) => ({ page: c.page as number, section: c.section as string, snippet: c.text, score: cosine(qv!, c.embedding as number[]) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((c) => ({ ...c, score: Number(c.score.toFixed(4)) }));
};