import { env } from '../../config/env';
import { discover, ModelEntry, pinned, scoreModel, tryModels } from './catalog';
import { formWith, jsonRequest, request } from './http';
import { AdapterInput, AdapterResult, ProviderAdapter, ProviderError } from './types';

const BASE = 'https://api.groq.com/openai/v1';
const auth = () => ({ Authorization: `Bearer ${env.GROQ_API_KEY}` });

interface GroqModel { id: string; active?: boolean; context_window?: number }

const NOT_CHAT = /whisper|tts|playai|orpheus|guard|safeguard|embed|moderation/i;

/** Groq lists exactly the models this key can use, so "does not exist or no access" 404s cannot happen. */
export const discoverGroq = (task: 'text' | 'stt') =>
  discover('groq', task, async (): Promise<ModelEntry[]> => {
    const res = await request('groq', `${BASE}/models`, { headers: auth(), timeoutMs: 20000 });
    const data: GroqModel[] = ((await res.json()) as { data?: GroqModel[] }).data || [];
    return data
      .filter((m) => m.id && m.active !== false)
      .filter((m) => (task === 'stt' ? /whisper/i.test(m.id) : !NOT_CHAT.test(m.id)))
      .map((m) => ({ id: m.id, score: task === 'stt' ? (/large/i.test(m.id) ? 5 : 0) + (/turbo/i.test(m.id) ? 3 : 0) : scoreModel(m.id, m.context_window) }));
  });

export const groq: ProviderAdapter = {
  name: 'groq',
  supports: ['text.generate', 'speech.stt', 'video.stt'],
  isConfigured: () => !!env.GROQ_API_KEY,
  async run(input: AdapterInput): Promise<AdapterResult> {
    if (!env.GROQ_API_KEY) throw new ProviderError('groq', 'Groq is not configured', undefined, 'config');

    if (input.capability === 'speech.stt' || input.capability === 'video.stt') {
      if (!input.audio) throw new ProviderError('groq', 'Audio required', 400, 'bad_input');
      const audio = input.audio;
      const models = pinned(input.options?.model) || (await discoverGroq('stt'));
      const { model, value } = await tryModels({
        provider: 'groq', task: 'stt', models, max: 3, deadlineAt: input.options?.deadlineAt,
        run: async (id) => {
          const form = formWith(
            { model: id, response_format: 'verbose_json', ...(input.options?.language ? { language: input.options.language } : {}) },
            { name: 'file', buffer: audio.buffer, mime: audio.mime, filename: audio.filename || 'audio' },
          );
          const res = await request('groq', `${BASE}/audio/transcriptions`, { method: 'POST', headers: auth(), body: form, timeoutMs: 120000 });
          return (await res.json()) as { text: string; segments?: { start: number; end: number; text: string }[] };
        },
      });
      return { provider: 'groq', model, text: value.text, segments: (value.segments || []).map((s) => ({ start: s.start, end: s.end, text: String(s.text).trim() })) };
    }

    const models = pinned(input.options?.model) || (await discoverGroq('text'));
    const { model, value } = await tryModels({
      provider: 'groq', task: 'text', models, max: 4, deadlineAt: input.options?.deadlineAt,
      run: async (id, timeoutMs) => {
        const res = await jsonRequest<{ choices?: { message?: { content?: string } }[] }>(
          'groq', `${BASE}/chat/completions`, auth(),
          { model: id, messages: input.messages, temperature: input.temperature ?? 0.7, max_tokens: input.maxTokens ?? 2048 }, timeoutMs,
        );
        const text = res.choices?.[0]?.message?.content?.trim();
        if (!text) throw new ProviderError('groq', `${id} returned an empty answer`, undefined, 'server');
        return text;
      },
    });
    return { provider: 'groq', model, text: value };
  },
};