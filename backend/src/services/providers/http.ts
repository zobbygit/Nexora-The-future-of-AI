import { ProviderError } from './types';
import { ProviderName } from '../../config/tools';

const classify = (provider: ProviderName, status: number, body: string): ProviderError => {
  const msg = `${provider} responded ${status}: ${body.slice(0, 200)}`;
  if (status === 429) return new ProviderError(provider, msg, status, 'rate_limit');
  if (status === 404 || status === 410 || status === 422 || (status === 400 && /model/i.test(body))) return new ProviderError(provider, msg, status, 'model');
  // 401/403 = bad or restricted key, 402 = credits exhausted: all provider-wide, so don't try more models here.
  if (status === 401 || status === 402 || status === 403) return new ProviderError(provider, msg, status, 'config');
  if (status === 503 || status === 502) return new ProviderError(provider, msg, status, 'unavailable');
  if (status >= 500) return new ProviderError(provider, msg, status, 'server');
  return new ProviderError(provider, msg, status, 'bad_input');
};

export const request = async (
  provider: ProviderName,
  url: string,
  init: RequestInit & { timeoutMs?: number },
): Promise<Response> => {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(init.timeoutMs ?? 60000) });
    if (!res.ok) throw classify(provider, res.status, await res.text().catch(() => ''));
    return res;
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    const err = e as Error;
    if (err.name === 'TimeoutError' || err.name === 'AbortError') throw new ProviderError(provider, `${provider} timed out`, undefined, 'timeout');
    throw new ProviderError(provider, `${provider} network error: ${err.message}`, undefined, 'network');
  }
};

export const jsonRequest = async <T = any>(
  provider: ProviderName, url: string, headers: Record<string, string>, body: unknown, timeoutMs?: number,
): Promise<T> => {
  const res = await request(provider, url, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), timeoutMs,
  });
  return (await res.json()) as T;
};

export const toArrayBuffer = (b: Buffer): ArrayBuffer =>
  b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

export const formWith = (fields: Record<string, string>, file: { name: string; buffer: Buffer; mime: string; filename: string }) => {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  form.append(file.name, new Blob([toArrayBuffer(file.buffer)], { type: file.mime }), file.filename);
  return form;
};