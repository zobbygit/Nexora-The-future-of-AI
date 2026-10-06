import { env, isProd } from '../config/env';
import { Capability, ProviderName } from '../config/tools';
import { ProviderHealth } from '../models/ProviderHealth';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';
import { ADAPTERS, AdapterInput, AdapterResult, ProviderError } from './providers';
import { mockRun } from './providers/mock';

export interface Attempt { provider: ProviderName; model?: string; ok: boolean; latencyMs: number; error?: string }
export interface RouterOutcome { result: AdapterResult; attempts: Attempt[]; fallbackUsed: boolean; latencyMs: number }

/** In-process circuit breaker: skip a provider briefly after repeated failures. */
const breaker = new Map<ProviderName, { fails: number; until: number }>();
const BREAKER_THRESHOLD = 3;
const BREAKER_COOLDOWN_MS = 45_000;

export const resetBreakers = () => breaker.clear();
const isOpen = (p: ProviderName) => {
  const s = breaker.get(p);
  return !!s && s.fails >= BREAKER_THRESHOLD && s.until > Date.now();
};
const onFailure = (p: ProviderName) => {
  const s = breaker.get(p) || { fails: 0, until: 0 };
  s.fails += 1;
  if (s.fails >= BREAKER_THRESHOLD) s.until = Date.now() + BREAKER_COOLDOWN_MS;
  breaker.set(p, s);
};
const onSuccess = (p: ProviderName) => breaker.delete(p);

const recordHealth = async (attempt: Attempt, fellBack: boolean) => {
  try {
    if (attempt.ok) {
      await ProviderHealth.updateOne(
        { provider: attempt.provider },
        { $inc: { requests: 1, successes: 1, totalLatencyMs: attempt.latencyMs }, $set: { consecutiveFailures: 0, lastSuccessAt: new Date(), lastModel: attempt.model } },
        { upsert: true },
      );
    } else {
      await ProviderHealth.updateOne(
        { provider: attempt.provider },
        { $inc: { requests: 1, failures: 1, consecutiveFailures: 1, ...(fellBack ? { fallbacksFrom: 1 } : {}) }, $set: { lastError: attempt.error, lastErrorAt: new Date() } },
        { upsert: true },
      );
    }
  } catch (e) {
    logger.warn('health write failed', { err: (e as Error).message });
  }
};

const friendly = (attempts: Attempt[]): string => {
  const configured = attempts.filter((a) => !/not configured/i.test(a.error || ''));
  return configured.length
    ? 'The AI service is busy right now. Please try again in a moment.'
    : 'No AI provider is configured for this tool yet.';
};

/**
 * Capability-aware routing: tries `order` in sequence, skipping providers that do not support the
 * capability or whose circuit is open. Returns the first success plus a full attempt log.
 */
export const routeRequest = async (
  capability: Capability, order: ProviderName[], input: Omit<AdapterInput, 'capability'>,
): Promise<RouterOutcome> => {
  const started = Date.now();
  // Stop starting new model attempts after ~100s so the browser request (120s) never times out first.
  input = { ...input, options: { ...input.options, deadlineAt: started + 100_000 } };
  const attempts: Attempt[] = [];
  const candidates = order.filter((p) => ADAPTERS[p].supports.includes(capability));
  const live = candidates.filter((p) => !isOpen(p));
  const queue = live.length ? live : candidates; // if everything is tripped, try anyway

  for (let i = 0; i < queue.length; i++) {
    const name = queue[i];
    const adapter = ADAPTERS[name];
    const t0 = Date.now();
    try {
      const result = env.AI_MOCK
        ? mockRun(name, { ...input, capability })
        : await adapter.run({ ...input, capability });
      const attempt: Attempt = { provider: name, model: result.model, ok: true, latencyMs: Date.now() - t0 };
      attempts.push(attempt);
      onSuccess(name);
      await recordHealth(attempt, false);
      return { result, attempts, fallbackUsed: attempts.length > 1, latencyMs: Date.now() - started };
    } catch (e) {
      const err = e as Error;
      const notConfigured = e instanceof ProviderError && e.kind === 'config' && /not configured/i.test(err.message);
      const attempt: Attempt = { provider: name, ok: false, latencyMs: Date.now() - t0, error: err.message.slice(0, 300) };
      attempts.push(attempt);
      if (!notConfigured) {
        onFailure(name);
        await recordHealth(attempt, i < queue.length - 1);
      }
      logger.warn('provider failed', { provider: name, capability, error: attempt.error });
      if (e instanceof ProviderError && e.kind === 'bad_input' && e.status === 400) {
        // Bad input will fail everywhere — do not burn through fallbacks.
        break;
      }
    }
  }
  // OpenRouter's free models 404 with "data policy" until free endpoints are allowed in the account's privacy settings.
  const policy = /data policy/i.test(attempts.map((a) => a.error || '').join(' '));
  const hint = !isProd && policy ? ' Hint: allow free endpoints at openrouter.ai/settings/privacy.' : '';
  throw new AppError(502, 'AI_UNAVAILABLE', friendly(attempts) + hint, { attempts });
};