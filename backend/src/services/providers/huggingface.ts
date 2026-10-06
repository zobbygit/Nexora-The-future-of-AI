import { env } from '../../config/env';
import { discover, ModelEntry, pinned, scoreModel, Task, tryModels } from './catalog';
import { jsonRequest, request, toArrayBuffer } from './http';
import { AdapterInput, AdapterResult, ProviderAdapter, ProviderError } from './types';

const HUB = 'https://huggingface.co/api/models';
const ROUTER = 'https://router.huggingface.co';
const auth = () => ({ Authorization: `Bearer ${env.HF_API_TOKEN}` });

/** Hub pipeline tag per task, and which inference provider pool to search. */
const SEARCH: Record<Task, { tag: string; provider: string; extra?: string }> = {
  text: { tag: 'text-generation', provider: 'all', extra: '&filter=conversational' },
  vision: { tag: 'image-to-text', provider: 'hf-inference' },
  stt: { tag: 'automatic-speech-recognition', provider: 'hf-inference' },
  tts: { tag: 'text-to-speech', provider: 'hf-inference' },
  image: { tag: 'text-to-image', provider: 'hf-inference' },
  embedding: { tag: 'feature-extraction', provider: 'hf-inference' },
};

interface HubModel { id?: string; modelId?: string; gated?: boolean | string; downloads?: number }

/** Models that are actually served by an inference provider right now, most-downloaded first; gated repos skipped. */
export const discoverHuggingFace = (task: Task) =>
  discover('huggingface', task, async (): Promise<ModelEntry[]> => {
    const s = SEARCH[task];
    const url = `${HUB}?pipeline_tag=${s.tag}&inference_provider=${s.provider}&sort=downloads&direction=-1&limit=25${s.extra || ''}`;
    const res = await request('huggingface', url, { headers: env.HF_API_TOKEN ? auth() : {}, timeoutMs: 20000 });
    const list = (await res.json()) as HubModel[];
    return (Array.isArray(list) ? list : [])
      .map((m) => ({ id: m.id || m.modelId || '', gated: m.gated }))
      .filter((m) => m.id && !m.gated)
      .map((m, i) => ({ id: m.id, score: 25 - i + (task === 'text' ? scoreModel(m.id) / 2 : 0) }));
  });

const poolEmbedding = (r: unknown, n: number): number[][] => {
  if (!Array.isArray(r) || r.length !== n) throw new ProviderError('huggingface', 'unexpected embedding response', undefined, 'server');
  return (r as any[]).map((v) => {
    if (!Array.isArray(v[0])) return v as number[];
    const rows = v as number[][]; // token-level output → mean pool
    return rows[0].map((_, j) => rows.reduce((a, row) => a + row[j], 0) / rows.length);
  });
};

export const huggingface: ProviderAdapter = {
  name: 'huggingface',
  supports: ['text.generate', 'speech.tts', 'speech.stt', 'video.stt', 'vision.ocr', 'image.generate', 'embeddings'],
  isConfigured: () => !!env.HF_API_TOKEN,
  async run(input: AdapterInput): Promise<AdapterResult> {
    if (!env.HF_API_TOKEN) throw new ProviderError('huggingface', 'Hugging Face is not configured', undefined, 'config');
    const deadlineAt = input.options?.deadlineAt;
    const pick = async (task: Task) => pinned(input.options?.model) || (await discoverHuggingFace(task));
    const model$ = (id: string) => `${ROUTER}/hf-inference/models/${id}`;

    switch (input.capability) {
      case 'text.generate': {
        const { model, value } = await tryModels({ provider: 'huggingface', task: 'text', models: await pick('text'), max: 3, deadlineAt, run: async (id, t) => {
          const r = await jsonRequest<{ choices?: { message?: { content?: string } }[] }>('huggingface', `${ROUTER}/v1/chat/completions`, auth(),
            { model: id, messages: input.messages, max_tokens: input.maxTokens ?? 1800, temperature: input.temperature ?? 0.7 }, t);
          const text = r.choices?.[0]?.message?.content?.trim();
          if (!text) throw new ProviderError('huggingface', `${id} returned an empty answer`, undefined, 'server');
          return text;
        } });
        return { provider: 'huggingface', model, text: value };
      }
      case 'embeddings': {
        const texts = Array.isArray(input.text) ? input.text : [input.text || ''];
        const { model, value } = await tryModels({ provider: 'huggingface', task: 'embedding', models: await pick('embedding'), max: 3, deadlineAt, run: async (id) => {
          const res = await request('huggingface', `${model$(id)}/pipeline/feature-extraction`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ inputs: texts, options: { wait_for_model: true } }), timeoutMs: 45000 });
          return poolEmbedding(await res.json(), texts.length);
        } });
        return { provider: 'huggingface', model, embeddings: value };
      }
      case 'speech.stt':
      case 'video.stt': {
        if (!input.audio) throw new ProviderError('huggingface', 'Audio required', 400, 'bad_input');
        const audio = input.audio;
        const { model, value } = await tryModels({ provider: 'huggingface', task: 'stt', models: await pick('stt'), max: 3, deadlineAt, run: async (id) => {
          const res = await request('huggingface', model$(id), { method: 'POST', headers: { ...auth(), 'Content-Type': audio.mime }, body: toArrayBuffer(audio.buffer), timeoutMs: 120000 });
          const text = String(((await res.json()) as { text?: string }).text || '').trim();
          if (!text) throw new ProviderError('huggingface', `${id} heard no speech`, undefined, 'server');
          return text;
        } });
        return { provider: 'huggingface', model, text: value };
      }
      case 'speech.tts': {
        const { model, value } = await tryModels({ provider: 'huggingface', task: 'tts', models: await pick('tts'), max: 3, deadlineAt, run: async (id) => {
          const res = await request('huggingface', model$(id), { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json', Accept: 'audio/*' }, body: JSON.stringify({ inputs: input.text }), timeoutMs: 90000 });
          const buffer = Buffer.from(await res.arrayBuffer());
          if (buffer.length < 200) throw new ProviderError('huggingface', `${id} returned no audio`, undefined, 'server');
          return { buffer, mime: (res.headers.get('content-type') || 'audio/flac').split(';')[0] };
        } });
        return { provider: 'huggingface', model, buffer: value.buffer, mime: value.mime };
      }
      case 'image.generate': {
        const { model, value } = await tryModels({ provider: 'huggingface', task: 'image', models: await pick('image'), max: 3, deadlineAt, run: async (id) => {
          const res = await request('huggingface', model$(id), { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json', Accept: 'image/png' },
            body: JSON.stringify({ inputs: input.prompt, parameters: { width: input.options?.width, height: input.options?.height } }), timeoutMs: 120000 });
          const type = (res.headers.get('content-type') || 'image/png').split(';')[0];
          const buffer = Buffer.from(await res.arrayBuffer());
          if (!type.startsWith('image/') || buffer.length < 200) throw new ProviderError('huggingface', `${id} returned no image`, undefined, 'server');
          return { buffer, mime: type };
        } });
        return { provider: 'huggingface', model, buffer: value.buffer, mime: value.mime };
      }
      case 'vision.ocr': {
        if (!input.image) throw new ProviderError('huggingface', 'Image required', 400, 'bad_input');
        const image = input.image;
        const { model, value } = await tryModels({ provider: 'huggingface', task: 'vision', models: await pick('vision'), max: 3, deadlineAt, run: async (id) => {
          const res = await request('huggingface', model$(id), { method: 'POST', headers: { ...auth(), 'Content-Type': image.mime }, body: toArrayBuffer(image.buffer), timeoutMs: 90000 });
          const json: any = await res.json();
          const text = String((Array.isArray(json) ? json[0]?.generated_text : json?.generated_text) || '').trim();
          if (!text) throw new ProviderError('huggingface', `${id} found no text`, undefined, 'server');
          return text;
        } });
        return { provider: 'huggingface', model, text: value };
      }
      default:
        throw new ProviderError('huggingface', `Unsupported capability ${input.capability}`, 400, 'bad_input');
    }
  },
};