import { env } from '../../config/env';
import { discover, ModelEntry, pinned, scoreModel, tryModels } from './catalog';
import { jsonRequest, request } from './http';
import { AdapterInput, AdapterResult, ProviderAdapter, ProviderError } from './types';

const BASE = 'https://openrouter.ai/api/v1';
const headers = () => ({ Authorization: `Bearer ${env.OPENROUTER_API_KEY}`, 'HTTP-Referer': env.CLIENT_URL, 'X-Title': 'Nexora' });

interface OrModel {
  id: string; context_length?: number; expiration_date?: string | null;
  pricing?: { prompt?: string; completion?: string };
  architecture?: { input_modalities?: string[]; output_modalities?: string[] };
}

/** Free = both token prices are exactly zero. Everything else (paid, "auto" routers with negative price) is excluded. */
export const isFreeModel = (m: OrModel) => Number(m.pricing?.prompt) === 0 && Number(m.pricing?.completion) === 0;

export const discoverOpenRouter = (task: 'text' | 'vision') =>
  discover('openrouter', task, async (): Promise<ModelEntry[]> => {
    const res = await request('openrouter', `${BASE}/models`, { headers: env.OPENROUTER_API_KEY ? headers() : {}, timeoutMs: 20000 });
    const data: OrModel[] = ((await res.json()) as { data?: OrModel[] }).data || [];
    return data
      .filter((m) => m.id && isFreeModel(m))
      .filter((m) => !m.expiration_date || new Date(m.expiration_date).getTime() > Date.now())
      .filter((m) => {
        const input = m.architecture?.input_modalities || ['text'];
        const output = m.architecture?.output_modalities || ['text'];
        if (!output.includes('text') || output.some((o) => o === 'image' || o === 'audio')) return false;
        return task === 'vision' ? input.includes('image') && input.includes('text') : input.includes('text');
      })
      .map((m) => ({ id: m.id, score: scoreModel(m.id, m.context_length) }));
  });

const textOf = (content: unknown): string => {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((c) => (typeof c === 'string' ? c : (c as { text?: string })?.text || '')).join('');
  return '';
};

export const openrouter: ProviderAdapter = {
  name: 'openrouter',
  supports: ['text.generate', 'vision.ocr'],
  isConfigured: () => !!env.OPENROUTER_API_KEY,
  async run(input: AdapterInput): Promise<AdapterResult> {
    if (!env.OPENROUTER_API_KEY) throw new ProviderError('openrouter', 'OpenRouter is not configured', undefined, 'config');
    const vision = input.capability === 'vision.ocr';
    if (vision && !input.image) throw new ProviderError('openrouter', 'Image required', 400, 'bad_input');
    const task = vision ? 'vision' : 'text';
    const models = pinned(input.options?.model) || (await discoverOpenRouter(task));

    const messages = vision
      ? [{ role: 'user', content: [
          { type: 'text', text: input.prompt || 'Extract all text from this image.' },
          { type: 'image_url', image_url: { url: `data:${input.image!.mime};base64,${input.image!.buffer.toString('base64')}` } },
        ] }]
      : input.messages;

    const { model, value } = await tryModels({
      provider: 'openrouter', task, models, max: 4, deadlineAt: input.options?.deadlineAt,
      run: async (id, timeoutMs) => {
        const res = await jsonRequest<{ choices?: { message?: { content?: unknown } }[]; error?: { message?: string } }>(
          'openrouter', `${BASE}/chat/completions`, headers(),
          { model: id, messages, temperature: input.temperature ?? 0.7, max_tokens: input.maxTokens ?? (vision ? 2000 : 2048) }, timeoutMs,
        );
        const text = textOf(res.choices?.[0]?.message?.content).trim();
        if (!text) throw new ProviderError('openrouter', res.error?.message || `${id} returned an empty answer`, undefined, 'server');
        return text;
      },
    });
    return { provider: 'openrouter', model, text: value };
  },
};