jest.mock('../src/models/ProviderHealth', () => ({ ProviderHealth: { updateOne: jest.fn().mockResolvedValue({}) } }));
import { ADAPTERS, ProviderError } from '../src/services/providers';
import { resetBreakers, routeRequest } from '../src/services/providerRouter';
import { ProviderHealth } from '../src/models/ProviderHealth';

const ok = (provider: any) => ({ provider, model: 'm', text: 'hello' });
const spies: jest.SpyInstance[] = [];
const stub = (name: keyof typeof ADAPTERS, impl: () => any) => spies.push(jest.spyOn(ADAPTERS[name], 'run').mockImplementation(impl as any));

afterEach(() => { spies.splice(0).forEach((s) => s.mockRestore()); resetBreakers(); jest.clearAllMocks(); });

describe('provider router', () => {
  it('uses the primary provider when it succeeds', async () => {
    stub('openrouter', async () => ok('openrouter'));
    const out = await routeRequest('text.generate', ['openrouter', 'groq'], { messages: [] });
    expect(out.result.provider).toBe('openrouter');
    expect(out.fallbackUsed).toBe(false);
    expect(out.attempts).toHaveLength(1);
  });

  it('falls back on 429 and reports fallback usage', async () => {
    stub('openrouter', async () => { throw new ProviderError('openrouter', 'rate limited', 429, 'rate_limit'); });
    stub('groq', async () => ok('groq'));
    const out = await routeRequest('text.generate', ['openrouter', 'groq'], { messages: [] });
    expect(out.result.provider).toBe('groq');
    expect(out.fallbackUsed).toBe(true);
    expect(out.attempts.map((a) => [a.provider, a.ok])).toEqual([['openrouter', false], ['groq', true]]);
    expect(ProviderHealth.updateOne).toHaveBeenCalled();
  });

  it.each([
    ['timeout', 'timeout'], ['unavailable', 'unavailable'], ['model', 'model'], ['server', 'server'], ['network', 'network'],
  ])('falls back on %s errors', async (_n, kind) => {
    stub('cloudflare', async () => { throw new ProviderError('cloudflare', 'x', 500, kind as any); });
    stub('huggingface', async () => ({ provider: 'huggingface', model: 'm', buffer: Buffer.from('a'), mime: 'audio/flac' }));
    const out = await routeRequest('speech.tts', ['cloudflare', 'huggingface'], { text: 'hi' });
    expect(out.result.provider).toBe('huggingface');
  });

  it('skips providers that do not support the capability', async () => {
    const groq = jest.spyOn(ADAPTERS.groq, 'run');
    stub('cloudflare', async () => ({ provider: 'cloudflare', model: 'm', buffer: Buffer.from('a'), mime: 'audio/mpeg' }));
    const out = await routeRequest('speech.tts', ['groq', 'cloudflare'], { text: 'hi' });
    expect(out.result.provider).toBe('cloudflare');
    expect(groq).not.toHaveBeenCalled();
    groq.mockRestore();
  });

  it('throws a friendly 502 when every provider fails', async () => {
    stub('openrouter', async () => { throw new ProviderError('openrouter', 'down', 503, 'unavailable'); });
    stub('groq', async () => { throw new ProviderError('groq', 'down', 500, 'server'); });
    await expect(routeRequest('text.generate', ['openrouter', 'groq'], { messages: [] })).rejects.toMatchObject({ status: 502, code: 'AI_UNAVAILABLE' });
  });

  it('reports a configuration message when no provider is configured', async () => {
    await expect(routeRequest('text.generate', ['openrouter', 'groq'], { messages: [] })).rejects.toMatchObject({
      code: 'AI_UNAVAILABLE', message: expect.stringMatching(/configured/i),
    });
  });

  it('does not burn fallbacks on bad input', async () => {
    const groq = stub('groq', async () => ok('groq'));
    void groq;
    stub('openrouter', async () => { throw new ProviderError('openrouter', 'bad', 400, 'bad_input'); });
    await expect(routeRequest('text.generate', ['openrouter', 'groq'], { messages: [] })).rejects.toBeDefined();
    expect(ADAPTERS.groq.run).not.toHaveBeenCalled();
  });

  it('opens the circuit after repeated failures and prefers healthy providers', async () => {
    const failing = jest.fn(async () => { throw new ProviderError('openrouter', 'boom', 500, 'server'); });
    stub('openrouter', failing);
    stub('groq', async () => ok('groq'));
    for (let i = 0; i < 3; i++) await routeRequest('text.generate', ['openrouter', 'groq'], { messages: [] });
    failing.mockClear();
    const out = await routeRequest('text.generate', ['openrouter', 'groq'], { messages: [] });
    expect(failing).not.toHaveBeenCalled();
    expect(out.result.provider).toBe('groq');
  });
});
