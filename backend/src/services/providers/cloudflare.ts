import { env } from '../../config/env';
import { discover, ModelEntry, pinned, scoreModel, Task, tryModels } from './catalog';
import { request, toArrayBuffer } from './http';
import { AdapterInput, AdapterResult, ProviderAdapter, ProviderError } from './types';

const API = () => `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai`;
const auth = () => ({ Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` });

/** Workers AI task names as the model-search endpoint spells them. */
const CF_TASK: Record<Task, string> = {
  text: 'Text Generation', vision: 'Image-to-Text', stt: 'Automatic Speech Recognition',
  tts: 'Text-to-Speech', image: 'Text-to-Image', embedding: 'Text Embeddings',
};

interface CfModel { name: string; properties?: { property_id: string; value: unknown }[] }
const prop = (m: CfModel, id: string) => m.properties?.find((p) => p.property_id === id)?.value;
const deprecated = (m: CfModel) => { const d = prop(m, 'planned_deprecation_date'); return !!d && new Date(String(d)).getTime() < Date.now(); };

export const discoverCloudflare = (task: Task) =>
  discover('cloudflare', task, async (): Promise<ModelEntry[]> => {
    const list = async (hideExperimental: boolean): Promise<CfModel[]> => {
      const url = `${API()}/models/search?task=${encodeURIComponent(CF_TASK[task])}&per_page=100${hideExperimental ? '&hide_experimental=true' : ''}`;
      const res = await request('cloudflare', url, { headers: auth(), timeoutMs: 20000 });
      return (((await res.json()) as { result?: CfModel[] }).result || []);
    };
    let models = await list(true);
    if (!models.length) models = await list(false);
    return models
      .filter((m) => m.name && !deprecated(m) && !/lora/i.test(m.name))
      .map((m) => {
        const beta = String(prop(m, 'beta')) === 'true';
        const ctx = Number(prop(m, 'context_window') || prop(m, 'max_total_tokens') || 0);
        return { id: m.name, score: (task === 'text' ? scoreModel(m.name, ctx) : 10) - (beta ? 2 : 0) };
      });
  });

/** Each Workers AI model has its own input schema, so ask Cloudflare what this model accepts instead of guessing. */
const schemaCache = new Map<string, Record<string, string> | null>();
export const resetCloudflareSchemas = () => schemaCache.clear();
const collectTop = (node: any, out: Record<string, string>) => {
  if (!node || typeof node !== 'object') return out;
  if (node.properties && typeof node.properties === 'object') for (const [k, v] of Object.entries(node.properties)) out[k] = String((v as any)?.type ?? out[k] ?? 'unknown');
  for (const key of ['oneOf', 'anyOf', 'allOf']) if (Array.isArray(node[key])) node[key].forEach((n: unknown) => collectTop(n, out));
  return out;
};
export const inputSchema = async (model: string): Promise<Record<string, string> | null> => {
  if (schemaCache.has(model)) return schemaCache.get(model)!;
  try {
    const res = await request('cloudflare', `${API()}/models/schema?model=${encodeURIComponent(model)}`, { headers: auth(), timeoutMs: 15000 });
    const json: any = await res.json();
    const props = collectTop(json?.result?.input ?? json?.result, {});
    schemaCache.set(model, Object.keys(props).length ? props : null);
  } catch {
    schemaCache.set(model, null);
  }
  return schemaCache.get(model)!;
};
/** Keep only the fields the model declares; when the schema is unknown, send just the essentials. */
const shape = (values: Record<string, unknown>, props: Record<string, string> | null, essentials: string[]) => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) if (v !== undefined && (props ? k in props : essentials.includes(k))) out[k] = v;
  return out;
};

type Called = { json?: any; binary?: Buffer; mime?: string };
const call = async (model: string, body: { json?: unknown; binary?: Buffer; mime?: string }, timeoutMs: number): Promise<Called> => {
  const res = await request('cloudflare', `${API()}/run/${model}`, {
    method: 'POST',
    headers: { ...auth(), 'Content-Type': body.binary ? body.mime || 'application/octet-stream' : 'application/json' },
    body: body.binary ? toArrayBuffer(body.binary) : JSON.stringify(body.json), timeoutMs,
  });
  const type = res.headers.get('content-type') || '';
  if (!type.includes('json')) return { binary: Buffer.from(await res.arrayBuffer()), mime: type.split(';')[0] };
  const json: any = await res.json();
  if (json?.success === false) throw new ProviderError('cloudflare', json.errors?.[0]?.message || 'Cloudflare error', undefined, 'server');
  return { json: json?.result ?? json };
};

const textFrom = (r: any): string => {
  const v = r?.response ?? r?.choices?.[0]?.message?.content ?? r?.choices?.[0]?.text ?? r?.output_text ?? r?.description ?? r?.text;
  return typeof v === 'string' ? v.trim() : '';
};
const sniffImage = (b64: string) => (b64.startsWith('iVBOR') ? 'image/png' : b64.startsWith('/9j/') ? 'image/jpeg' : b64.startsWith('UklG') ? 'image/webp' : 'image/jpeg');

export const cloudflare: ProviderAdapter = {
  name: 'cloudflare',
  supports: ['text.generate', 'speech.tts', 'speech.stt', 'video.stt', 'vision.ocr', 'image.generate', 'embeddings'],
  isConfigured: () => !!env.CLOUDFLARE_ACCOUNT_ID && !!env.CLOUDFLARE_API_TOKEN,
  async run(input: AdapterInput): Promise<AdapterResult> {
    if (!cloudflare.isConfigured()) throw new ProviderError('cloudflare', 'Cloudflare is not configured', undefined, 'config');
    const deadlineAt = input.options?.deadlineAt;
    const pick = async (task: Task) => pinned(input.options?.model) || (await discoverCloudflare(task));

    switch (input.capability) {
      case 'text.generate': {
        const { model, value } = await tryModels({ provider: 'cloudflare', task: 'text', models: await pick('text'), max: 4, deadlineAt, run: async (id, t) => {
          const props = await inputSchema(id);
          const flat = (input.messages || []).map((m) => `${m.role}: ${m.content}`).join('\n\n');
          const body = props && !props.messages && props.prompt
            ? shape({ prompt: flat, max_tokens: input.maxTokens ?? 1800, temperature: input.temperature ?? 0.7 }, props, [])
            : shape({ messages: input.messages, max_tokens: input.maxTokens ?? 1800, temperature: input.temperature ?? 0.7 }, props, ['messages', 'max_tokens', 'temperature']);
          const text = textFrom((await call(id, { json: body }, t)).json);
          if (!text) throw new ProviderError('cloudflare', `${id} returned an empty answer`, undefined, 'server');
          return text;
        } });
        return { provider: 'cloudflare', model, text: value };
      }
      case 'embeddings': {
        const texts = Array.isArray(input.text) ? input.text : [input.text || ''];
        const { model, value } = await tryModels({ provider: 'cloudflare', task: 'embedding', models: await pick('embedding'), max: 3, deadlineAt, run: async (id, t) => {
          const r = (await call(id, { json: { text: texts } }, t)).json;
          const data = r?.data ?? r?.embeddings;
          if (!Array.isArray(data) || data.length !== texts.length) throw new ProviderError('cloudflare', `${id} returned no embeddings`, undefined, 'server');
          return data as number[][];
        } });
        return { provider: 'cloudflare', model, embeddings: value };
      }
      case 'speech.tts': {
        const { model, value } = await tryModels({ provider: 'cloudflare', task: 'tts', models: await pick('tts'), max: 3, deadlineAt, run: async (id, t) => {
          const props = await inputSchema(id);
          const body = shape({ prompt: input.text, text: input.text, lang: input.options?.lang || 'en' }, props, ['prompt', 'text']);
          const r = await call(id, { json: body }, t);
          if (r.binary) return { buffer: r.binary, mime: r.mime || 'audio/mpeg' };
          const b64 = typeof r.json === 'string' ? r.json : r.json?.audio;
          if (!b64) throw new ProviderError('cloudflare', `${id} returned no audio`, undefined, 'server');
          return { buffer: Buffer.from(b64, 'base64'), mime: 'audio/mpeg' };
        } });
        return { provider: 'cloudflare', model, buffer: value.buffer, mime: value.mime };
      }
      case 'image.generate': {
        const { model, value } = await tryModels({ provider: 'cloudflare', task: 'image', models: await pick('image'), max: 3, deadlineAt, run: async (id, t) => {
          const props = await inputSchema(id);
          const steps = input.options?.steps;
          const body = shape({ prompt: input.prompt, width: input.options?.width, height: input.options?.height, steps, num_steps: steps }, props, ['prompt']);
          const r = await call(id, { json: body }, Math.max(t, 60_000));
          if (r.binary) return { buffer: r.binary, mime: r.mime || 'image/png' };
          const b64 = typeof r.json === 'string' ? r.json : r.json?.image;
          if (!b64) throw new ProviderError('cloudflare', `${id} returned no image`, undefined, 'server');
          return { buffer: Buffer.from(b64, 'base64'), mime: sniffImage(b64) };
        } });
        return { provider: 'cloudflare', model, buffer: value.buffer, mime: value.mime };
      }
      case 'speech.stt':
      case 'video.stt': {
        if (!input.audio) throw new ProviderError('cloudflare', 'Audio required', 400, 'bad_input');
        const audio = input.audio;
        const { model, value } = await tryModels({ provider: 'cloudflare', task: 'stt', models: await pick('stt'), max: 3, deadlineAt, run: async (id) => {
          const props = await inputSchema(id);
          let r: Called;
          if (props?.audio === 'string') r = await call(id, { json: shape({ audio: audio.buffer.toString('base64'), language: input.options?.language }, props, ['audio']) }, 120_000);
          else if (props?.audio === 'array') r = await call(id, { json: shape({ audio: Array.from(audio.buffer), language: input.options?.language }, props, ['audio']) }, 120_000);
          else r = await call(id, { binary: audio.buffer, mime: 'application/octet-stream' }, 120_000);
          const text = String(r.json?.text ?? '').trim();
          if (!text) throw new ProviderError('cloudflare', `${id} heard no speech`, undefined, 'server');
          const segs = Array.isArray(r.json?.segments) ? r.json.segments.map((s: any) => ({ start: s.start, end: s.end, text: String(s.text).trim() })) : undefined;
          return { text, segs };
        } });
        return { provider: 'cloudflare', model, text: value.text, segments: value.segs };
      }
      case 'vision.ocr': {
        if (!input.image) throw new ProviderError('cloudflare', 'Image required', 400, 'bad_input');
        const image = input.image;
        const { model, value } = await tryModels({ provider: 'cloudflare', task: 'vision', models: await pick('vision'), max: 3, deadlineAt, run: async (id, t) => {
          const props = await inputSchema(id);
          const prompt = input.prompt || 'Transcribe all text in this image.';
          const dataUrl = `data:${image.mime};base64,${image.buffer.toString('base64')}`;
          const body = props && props.messages && !props.image
            ? { messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: dataUrl } }] }], max_tokens: 1024 }
            : shape({ image: props?.image === 'string' ? image.buffer.toString('base64') : Array.from(image.buffer), prompt, max_tokens: 1024 }, props, ['image', 'prompt', 'max_tokens']);
          const text = textFrom((await call(id, { json: body }, Math.max(t, 60_000))).json);
          if (!text) throw new ProviderError('cloudflare', `${id} found no text`, undefined, 'server');
          return text;
        } });
        return { provider: 'cloudflare', model, text: value };
      }
      default:
        throw new ProviderError('cloudflare', `Unsupported capability ${input.capability}`, 400, 'bad_input');
    }
  },
};