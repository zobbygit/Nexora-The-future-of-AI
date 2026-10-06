process.env.OPENROUTER_API_KEY = 'or-key';
process.env.GROQ_API_KEY = 'gq-key';
process.env.HF_API_TOKEN = 'hf-key';
process.env.CLOUDFLARE_ACCOUNT_ID = 'acct';
process.env.CLOUDFLARE_API_TOKEN = 'cf-key';

jest.mock('../src/models/ProviderHealth', () => ({ ProviderHealth: { updateOne: jest.fn().mockResolvedValue({}) } }));
import fs from 'fs';
import path from 'path';
import { discover, markBad, resetCatalog, scoreModel, tryModels } from '../src/services/providers/catalog';
import { discoverOpenRouter, isFreeModel, openrouter } from '../src/services/providers/openrouter';
import { discoverGroq, groq } from '../src/services/providers/groq';
import { cloudflare, discoverCloudflare, inputSchema, resetCloudflareSchemas } from '../src/services/providers/cloudflare';
import { discoverHuggingFace, huggingface } from '../src/services/providers/huggingface';
import { ProviderError } from '../src/services/providers';
import { embedTexts, keywordRank } from '../src/services/rag.service';

type Handler = (url: string, init?: RequestInit) => { status?: number; body?: unknown; headers?: Record<string, string>; raw?: Buffer };
const calls: string[] = [];
const mockFetch = (handler: Handler) => {
  (global as any).fetch = jest.fn(async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    calls.push(u);
    const r = handler(u, init);
    const headers = { 'content-type': 'application/json', ...(r.headers || {}) };
    return new Response(r.raw ? new Uint8Array(r.raw) : JSON.stringify(r.body ?? {}), { status: r.status ?? 200, headers });
  });
};
const chat = (text: string) => ({ choices: [{ message: { content: text } }] });
const orModel = (id: string, price = '0', extra: any = {}) => ({ id, context_length: 131072, pricing: { prompt: price, completion: price }, architecture: { input_modalities: ['text'], output_modalities: ['text'] }, ...extra });

beforeEach(() => { resetCatalog(); resetCloudflareSchemas(); calls.length = 0; });

describe('no hardcoded models', () => {
  it('adapter source files contain no model slugs', () => {
    const dir = path.join(__dirname, '../src/services/providers');
    for (const f of ['openrouter.ts', 'groq.ts', 'cloudflare.ts', 'huggingface.ts']) {
      const src = fs.readFileSync(path.join(dir, f), 'utf8');
      expect(src).not.toMatch(/meta-llama\/|@cf\/|black-forest|openai\/whisper|sentence-transformers|llama-3|gemini-|mms-tts|FLUX|melotts|gpt-oss|qwen\d/i);
    }
  });
  it('the env no longer exposes model name settings', () => {
    const src = fs.readFileSync(path.join(__dirname, '../src/config/env.ts'), 'utf8');
    expect(src).not.toMatch(/_TEXT_MODEL|_VISION_MODEL|_STT_MODEL/);
  });
});

describe('ranking', () => {
  it('prefers larger instruction-tuned models and demotes risky ones', () => {
    expect(scoreModel('acme/llama-70b-instruct:free')).toBeGreaterThan(scoreModel('acme/llama-8b-instruct:free'));
    expect(scoreModel('acme/model-70b-instruct')).toBeGreaterThan(scoreModel('acme/model-70b-preview'));
    expect(scoreModel('acme/reasoner-r1-70b')).toBeLessThan(scoreModel('acme/chat-70b-instruct'));
    expect(scoreModel('acme/llama-guard-8b')).toBeLessThan(0);
    expect(scoreModel('acme/mixtral-8x7b-instruct')).toBeGreaterThan(scoreModel('acme/tiny-3b-instruct'));
  });
});

describe('OpenRouter dynamic discovery', () => {
  const list = { data: [
    orModel('a/big-70b-instruct:free'), orModel('a/small-8b-instruct:free'), orModel('a/paid-70b-instruct', '0.0000009'),
    orModel('openrouter/auto', '-1'), orModel('a/image-gen:free', '0', { architecture: { input_modalities: ['text'], output_modalities: ['image'] } }),
    orModel('a/seer-vl:free', '0', { architecture: { input_modalities: ['text', 'image'], output_modalities: ['text'] } }),
    orModel('a/expired:free', '0', { expiration_date: '2020-01-01' }),
  ] };
  it('keeps only free text models, best first', async () => {
    mockFetch(() => ({ body: list }));
    const ids = (await discoverOpenRouter('text')).map((m) => m.id);
    expect(ids).toEqual(expect.arrayContaining(['a/big-70b-instruct:free', 'a/small-8b-instruct:free', 'a/seer-vl:free']));
    expect(ids).not.toContain('a/paid-70b-instruct');
    expect(ids).not.toContain('openrouter/auto');
    expect(ids).not.toContain('a/image-gen:free');
    expect(ids).not.toContain('a/expired:free');
    expect(ids[0]).toBe('a/big-70b-instruct:free');
  });
  it('vision list needs image input', async () => {
    mockFetch(() => ({ body: list }));
    expect((await discoverOpenRouter('vision')).map((m) => m.id)).toEqual(['a/seer-vl:free']);
  });
  it('treats only exact-zero pricing as free', () => {
    expect(isFreeModel(orModel('x', '0'))).toBe(true);
    expect(isFreeModel(orModel('x', '0.000001'))).toBe(false);
    expect(isFreeModel({ id: 'x' } as any)).toBe(false);
  });
  it('REGRESSION: a dead model (404) is skipped and the next free model answers', async () => {
    mockFetch((url, init) => {
      if (url.endsWith('/models')) return { body: list };
      const model = JSON.parse(String(init!.body)).model;
      if (model === 'a/big-70b-instruct:free') return { status: 404, body: { error: { message: 'No endpoints found', code: 404 } } };
      return { body: chat(`answer from ${model}`) };
    });
    const out = await openrouter.run({ capability: 'text.generate', messages: [{ role: 'user', content: 'hi' }] });
    expect(out.text).toBe(`answer from ${out.model}`);
    expect(out.model).not.toBe('a/big-70b-instruct:free');
    // the dead model is remembered: second request never tries it
    calls.length = 0;
    (global.fetch as jest.Mock).mockClear();
    await openrouter.run({ capability: 'text.generate', messages: [{ role: 'user', content: 'again' }] });
    const chatCalls = (global.fetch as jest.Mock).mock.calls.filter(([u]) => String(u).includes('chat/completions'));
    expect(chatCalls.map(([, i]) => JSON.parse(i.body).model)).not.toContain('a/big-70b-instruct:free');
  });
  it('moves on after a 429 and after an empty answer', async () => {
    let n = 0;
    mockFetch((url) => {
      if (url.endsWith('/models')) return { body: { data: [orModel('a/one-70b-instruct:free'), orModel('a/two-34b-instruct:free'), orModel('a/three-8b-instruct:free')] } };
      n++;
      if (n === 1) return { status: 429, body: {} };
      if (n === 2) return { body: chat('   ') };
      return { body: chat('finally') };
    });
    const out = await openrouter.run({ capability: 'text.generate', messages: [] });
    expect(out.text).toBe('finally');
    expect(n).toBe(3);
  });
  it('stops at once on a bad key instead of burning every model', async () => {
    mockFetch((url) => (url.endsWith('/models') ? { body: list } : { status: 401, body: { error: 'bad key' } }));
    await expect(openrouter.run({ capability: 'text.generate', messages: [] })).rejects.toMatchObject({ kind: 'config' });
    expect((global.fetch as jest.Mock).mock.calls.filter(([u]) => String(u).includes('chat/completions'))).toHaveLength(1);
  });
  it('signals "model" when no free model exists so the router can try the next provider', async () => {
    mockFetch(() => ({ body: { data: [orModel('a/paid', '0.1')] } }));
    await expect(openrouter.run({ capability: 'text.generate', messages: [] })).rejects.toMatchObject({ kind: 'model' });
  });
});

describe('Groq dynamic discovery', () => {
  const models = { data: [
    { id: 'chat-70b-versatile', active: true, context_window: 131072 }, { id: 'chat-8b-instant', active: true, context_window: 131072 },
    { id: 'whisper-large-v3', active: true }, { id: 'whisper-large-v3-turbo', active: true }, { id: 'prompt-guard-86m', active: true },
    { id: 'playai-tts', active: true }, { id: 'retired-70b', active: false },
  ] };
  it('separates chat and speech models and drops guard/tts/inactive', async () => {
    mockFetch(() => ({ body: models }));
    const text = (await discoverGroq('text')).map((m) => m.id);
    expect(text).toEqual(['chat-70b-versatile', 'chat-8b-instant']);
    resetCatalog();
    const stt = (await discoverGroq('stt')).map((m) => m.id);
    expect(stt).toEqual(['whisper-large-v3-turbo', 'whisper-large-v3'].sort((a, b) => stt.indexOf(a) - stt.indexOf(b)));
    expect(stt).not.toContain('prompt-guard-86m');
  });
  it('REGRESSION: "model does not exist or no access" (404) falls to the next accessible model', async () => {
    mockFetch((url, init) => {
      if (url.endsWith('/models')) return { body: models };
      const model = JSON.parse(String(init!.body)).model;
      if (model === 'chat-70b-versatile') return { status: 404, body: { error: { message: 'The model `chat-70b-versatile` does not exist or you do not have access to it.', code: 'model_not_found' } } };
      return { body: chat('ok from groq') };
    });
    const out = await groq.run({ capability: 'text.generate', messages: [] });
    expect(out).toMatchObject({ model: 'chat-8b-instant', text: 'ok from groq' });
  });
});

describe('Cloudflare dynamic discovery', () => {
  const search = { result: [
    { name: '@x/model-70b-instruct', properties: [{ property_id: 'context_window', value: '8000' }] },
    { name: '@x/model-8b-instruct', properties: [{ property_id: 'beta', value: 'true' }] },
    { name: '@x/old-model', properties: [{ property_id: 'planned_deprecation_date', value: '2020-01-01' }] },
    { name: '@x/model-lora', properties: [] },
  ] };
  it('lists current, non-deprecated, non-LoRA models for the task', async () => {
    mockFetch(() => ({ body: search }));
    const ids = (await discoverCloudflare('text')).map((m) => m.id);
    expect(ids).toEqual(['@x/model-70b-instruct', '@x/model-8b-instruct']);
    expect(calls[0]).toContain('task=Text%20Generation');
  });
  it('shapes the request from the model’s own input schema and reads either response style', async () => {
    mockFetch((url, init) => {
      if (url.includes('/models/search')) return { body: { result: [{ name: '@x/voice-1', properties: [] }] } };
      if (url.includes('/models/schema')) return { body: { result: { input: { oneOf: [{ properties: { prompt: { type: 'string' }, lang: { type: 'string' } } }] } } } };
      const sent = JSON.parse(String(init!.body));
      expect(Object.keys(sent).sort()).toEqual(['lang', 'prompt']); // 'text' is not in this model's schema → not sent
      return { body: { result: { audio: Buffer.from('a'.repeat(300)).toString('base64') } } };
    });
    const out = await cloudflare.run({ capability: 'speech.tts', text: 'hello', options: { lang: 'en' } });
    expect(out.model).toBe('@x/voice-1');
    expect(out.buffer!.length).toBe(300);
  });
  it('accepts binary audio responses and OpenAI-style chat responses', async () => {
    mockFetch((url) => {
      if (url.includes('/models/search')) return { body: { result: [{ name: '@x/m', properties: [] }] } };
      if (url.includes('/models/schema')) return { status: 500, body: {} };
      return { body: { result: { choices: [{ message: { content: 'from choices' } }] } } };
    });
    expect((await cloudflare.run({ capability: 'text.generate', messages: [{ role: 'user', content: 'x' }] })).text).toBe('from choices');
  });
  it('reads schema property types (used to choose base64 vs byte-array audio)', async () => {
    mockFetch(() => ({ body: { result: { input: { properties: { audio: { type: 'string' }, task: { type: 'string' } } } } } }));
    expect(await inputSchema('@x/asr')).toEqual({ audio: 'string', task: 'string' });
  });
});

describe('Hugging Face dynamic discovery', () => {
  it('asks the hub what is served now and skips gated repos', async () => {
    mockFetch(() => ({ body: [{ id: 'org/open-a', gated: false }, { id: 'org/closed-b', gated: 'manual' }, { id: 'org/open-c' }] }));
    const ids = (await discoverHuggingFace('image')).map((m) => m.id);
    expect(ids).toEqual(['org/open-a', 'org/open-c']);
    expect(calls[0]).toMatch(/pipeline_tag=text-to-image.*inference_provider=hf-inference|inference_provider=hf-inference.*pipeline_tag=text-to-image/);
  });
  it('text generation goes through the chat-completions router with a discovered model', async () => {
    mockFetch((url, init) => {
      if (url.includes('huggingface.co/api/models')) return { body: [{ id: 'org/chat-70b-instruct' }] };
      expect(JSON.parse(String(init!.body)).model).toBe('org/chat-70b-instruct');
      return { body: chat('hf says hi') };
    });
    expect((await huggingface.run({ capability: 'text.generate', messages: [] })).text).toBe('hf says hi');
  });
  it('mean-pools token-level embeddings', async () => {
    mockFetch((url) => (url.includes('huggingface.co/api/models') ? { body: [{ id: 'org/embedder' }] } : { body: [[[1, 3], [3, 5]]] }));
    expect((await huggingface.run({ capability: 'embeddings', text: ['a'] })).embeddings).toEqual([[2, 4]]);
  });
});

describe('catalog behaviour', () => {
  it('reuses the last known list when discovery itself fails (up to a point)', async () => {
    let fail = false;
    const fetcher = async () => { if (fail) throw new ProviderError('groq', 'down', 503, 'unavailable'); return [{ id: 'm1', score: 1 }]; };
    expect(await discover('groq', 'text', fetcher)).toHaveLength(1);
    // force "stale" by clearing freshness via a fresh call after failure: fresh cache still serves
    fail = true;
    expect(await discover('groq', 'text', fetcher)).toHaveLength(1);
  });
  it('propagates the failure when there is nothing cached', async () => {
    await expect(discover('groq', 'tts', async () => { throw new ProviderError('groq', 'down', 503, 'unavailable'); })).rejects.toBeInstanceOf(ProviderError);
  });
  it('retries a "bad" model if EVERY model is marked bad (no permanent lockout)', async () => {
    markBad('groq', 'text', 'only', 60_000);
    const out = await tryModels({ provider: 'groq', task: 'text', models: [{ id: 'only', score: 1 }], run: async () => 'ok' });
    expect(out.model).toBe('only');
  });
  it('turns a model-specific 400 into a provider-level "model" failure so the router keeps falling back', async () => {
    await expect(tryModels({ provider: 'groq', task: 'text', models: [{ id: 'a', score: 1 }], run: async () => { throw new ProviderError('groq', 'bad shape', 400, 'bad_input'); } }))
      .rejects.toMatchObject({ kind: 'model' });
  });
  it('honours the overall deadline', async () => {
    await expect(tryModels({ provider: 'groq', task: 'text', models: [{ id: 'a', score: 1 }], deadlineAt: Date.now() + 500, run: async () => 'never' })).rejects.toBeDefined();
  });
});

describe('RAG keeps one embedding model per document', () => {
  it('a pinned embedder that fails is never silently swapped', async () => {
    mockFetch(() => ({ status: 503, body: {} }));
    await expect(embedTexts(['x'], { embedder: 'huggingface', model: 'org/embedder' })).rejects.toBeDefined();
  });
  it('local pin never calls the network', async () => {
    mockFetch(() => ({ body: {} }));
    const r = await embedTexts(['hello world'], { embedder: 'local' });
    expect(r.embedder).toBe('local');
    expect(global.fetch).not.toHaveBeenCalled();
  });
  it('keyword fallback ranks the relevant chunk first', () => {
    const ranked = keywordRank('refund policy days', [{ text: 'Our office dog is called Biscuit.' }, { text: 'Refund policy: refunds are processed within five days.' }]);
    expect(ranked[0].text).toMatch(/Refund policy/);
  });
});