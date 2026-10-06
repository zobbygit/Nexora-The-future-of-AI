import { DEFAULT_PLANS, PROVIDERS, TOOLS, getTool } from '../src/config/tools';

describe('tool & plan configuration', () => {
  it('defines exactly 13 tools and no text-to-video', () => {
    expect(TOOLS).toHaveLength(13);
    expect(TOOLS.map((t) => t.id)).not.toContain('text-to-video');
    expect(new Set(TOOLS.map((t) => t.id)).size).toBe(13);
  });

  it('marks exactly the five documented tools as Free', () => {
    const free = TOOLS.filter((t) => t.plan === 'free').map((t) => t.id).sort();
    expect(free).toEqual(['agent', 'code', 'pdf', 'resume', 'writer']);
  });

  it('uses only the five allowed providers', () => {
    expect(PROVIDERS.sort()).toEqual(['clipdrop', 'cloudflare', 'groq', 'huggingface', 'openrouter']);
    TOOLS.forEach((t) => t.providers.forEach((p) => expect(PROVIDERS).toContain(p)));
  });

  it('routes each tool to its documented providers', () => {
    expect(getTool('writer')!.providers).toEqual(['openrouter', 'groq', 'cloudflare', 'huggingface']);
    expect(getTool('pdf')!.providers).toEqual(['openrouter', 'groq', 'cloudflare', 'huggingface']);
    expect(getTool('stt')!.providers).toEqual(['groq', 'cloudflare', 'huggingface']);
    expect(getTool('background-remover')!.providers).toEqual(['clipdrop']);
    expect(getTool('text-to-image')!.providers).toEqual(['cloudflare', 'huggingface']);
  });

  it('keeps plan pricing per the spec', () => {
    expect(DEFAULT_PLANS.free).toMatchObject({ priceInr: 0, creditsPerPeriod: 20, period: 'day' });
    expect(DEFAULT_PLANS.pro.priceInr).toBe(400);
  });
});