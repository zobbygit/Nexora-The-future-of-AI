import { ProviderName } from '../../config/tools';
import { logger } from '../../utils/logger';
import { ProviderError } from './types';

/**
 * Live model catalogue. NO model names are hardcoded anywhere in the backend: every provider adapter asks the
 * provider (OpenRouter /models, Groq /models, Cloudflare model search, Hugging Face hub) which models are
 * available right now, filters to the free/accessible ones for the task, ranks them, and walks down the list
 * until one answers. Dead models are remembered for a while so the next request skips them.
 */
export type Task = 'text' | 'vision' | 'stt' | 'tts' | 'image' | 'embedding';
export interface ModelEntry { id: string; score: number }

const FRESH_MS = 10 * 60_000;       // re-discover every 10 minutes
const STALE_OK_MS = 6 * 3600_000;   // if discovery itself fails, reuse the last list for up to 6 hours
const cache = new Map<string, { at: number; models: ModelEntry[] }>();
const inflight = new Map<string, Promise<ModelEntry[]>>();
const bad = new Map<string, number>();
const k = (p: ProviderName, t: Task) => `${p}|${t}`;
const badKey = (p: ProviderName, t: Task, m: string) => `${p}|${t}|${m}`;

export const resetCatalog = () => { cache.clear(); inflight.clear(); bad.clear(); };

export const discover = async (provider: ProviderName, task: Task, fetcher: () => Promise<ModelEntry[]>): Promise<ModelEntry[]> => {
  const key = k(provider, task);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < FRESH_MS) return hit.models;
  let pending = inflight.get(key);
  if (!pending) {
    pending = fetcher()
      .then((m) => { const sorted = [...m].sort((a, b) => b.score - a.score); cache.set(key, { at: Date.now(), models: sorted }); return sorted; })
      .finally(() => inflight.delete(key));
    inflight.set(key, pending);
  }
  try {
    return await pending;
  } catch (e) {
    if (hit && Date.now() - hit.at < STALE_OK_MS) {
      logger.warn('model discovery failed, using last known list', { provider, task, err: (e as Error).message });
      return hit.models;
    }
    throw e;
  }
};

export const markBad = (provider: ProviderName, task: Task, model: string, ms: number) => { bad.set(badKey(provider, task, model), Date.now() + ms); };
export const isBad = (provider: ProviderName, task: Task, model: string) => (bad.get(badKey(provider, task, model)) ?? 0) > Date.now();

/** Heuristic ranking from the model id alone (bigger + instruction-tuned first, risky variants last). */
export const scoreModel = (id: string, contextLength = 0): number => {
  const s = id.toLowerCase();
  const moe = s.match(/(\d+)x(\d+(?:\.\d+)?)b/);
  const dense = s.match(/(\d+(?:\.\d+)?)b(?![a-z])/);
  const size = moe ? Number(moe[1]) * Number(moe[2]) : dense ? Number(dense[1]) : 0;
  let score = size ? Math.min(Math.log2(size + 1) * 4, 30) : 8;
  if (/instruct|chat|(^|[-_/])it([-_:]|$)|turbo|versatile/.test(s)) score += 6;
  if (/preview|experimental|(^|[-_/])exp([-_:]|$)|beta/.test(s)) score -= 3;
  if (/(^|[-_/])r1|reason|think|qwq/.test(s)) score -= 4;
  if (/guard|safety|moderation|embed|whisper|tts|stable-diffusion|flux/.test(s)) score -= 50;
  return score + Math.min(contextLength / 100_000, 5);
};

export interface TryOptions<T> {
  provider: ProviderName;
  task: Task;
  models: ModelEntry[];
  max?: number;
  deadlineAt?: number;
  run: (model: string, timeoutMs: number) => Promise<T>;
}

/**
 * Walks the ranked list until one model answers. Model-level problems (404, rate limit, timeout, empty answer,
 * odd input shape) move on to the next model; provider-level problems (bad key, no credits, network down) stop
 * immediately so the router can fall back to the next provider.
 */
export const tryModels = async <T>(o: TryOptions<T>): Promise<{ model: string; value: T }> => {
  const live = o.models.filter((m) => !isBad(o.provider, o.task, m.id));
  const list = (live.length ? live : o.models).slice(0, o.max ?? 4);
  if (!list.length) throw new ProviderError(o.provider, `${o.provider} has no available ${o.task} models right now`, undefined, 'model');

  let last: unknown;
  for (const m of list) {
    const remaining = (o.deadlineAt ?? Infinity) - Date.now();
    if (remaining < 3000) break;
    try {
      return { model: m.id, value: await o.run(m.id, Math.min(45_000, remaining)) };
    } catch (e) {
      last = e;
      if (e instanceof ProviderError) {
        if (e.kind === 'config' || e.kind === 'network') throw e;
        const ttl = e.kind === 'rate_limit' ? 60_000 : e.kind === 'model' ? 30 * 60_000 : 3 * 60_000;
        markBad(o.provider, o.task, m.id, ttl);
        logger.warn('model failed, trying next', { provider: o.provider, task: o.task, model: m.id, kind: e.kind, status: e.status });
      } else {
        markBad(o.provider, o.task, m.id, 5 * 60_000);
      }
    }
  }
  if (last instanceof ProviderError) {
    // Whatever the last model complained about, from the router's point of view this provider could not serve it.
    throw last.kind === 'bad_input' ? new ProviderError(o.provider, last.message, last.status, 'model') : last;
  }
  throw new ProviderError(o.provider, `${o.provider}: no ${o.task} model answered`, undefined, 'server');
};

/** A pinned model (used for embeddings so a document's vectors always come from one model). */
export const pinned = (id?: unknown): ModelEntry[] | null => (typeof id === 'string' && id ? [{ id, score: 100 }] : null);