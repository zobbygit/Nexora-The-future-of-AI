import { errorMessage, errorCode, formatBytes, formatCountdown, formatInr, slug, timeAgo } from '../src/lib/utils';
import { CATEGORIES, TOOL_META, toolName, toolPath } from '../src/lib/tools';

describe('formatting helpers', () => {
  it('formats bytes and rupees', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(5 * 1048576)).toBe('5.0 MB');
    expect(formatInr(400)).toBe('₹400');
  });
  it('formats relative time', () => {
    expect(timeAgo(new Date())).toBe('just now');
    expect(timeAgo(new Date(Date.now() - 5 * 60_000))).toBe('5m ago');
    expect(timeAgo(new Date(Date.now() - 3 * 3600_000))).toBe('3h ago');
  });
  it('formats a countdown to the next reset', () => {
    expect(formatCountdown(new Date(Date.now() + 2 * 3600_000 + 5 * 60_000 + 500))).toBe('2h 05m');
    expect(formatCountdown(undefined)).toBe('');
    expect(formatCountdown(new Date(Date.now() - 1000))).toBe('0h 00m');
  });
  it('slugifies file names', () => { expect(slug('Q3 Launch — Brief!')).toBe('q3-launch-brief'); expect(slug('???')).toBe('nexora'); });
  it('extracts API error details', () => {
    const e = { response: { data: { error: { message: 'Nope', code: 'PRO_REQUIRED' } } } };
    expect(errorMessage(e)).toBe('Nope');
    expect(errorCode(e)).toBe('PRO_REQUIRED');
    expect(errorMessage({ message: 'Network Error' }, 'fallback')).toBe('fallback');
  });
});

describe('tool metadata', () => {
  it('contains the 13 tools in the 5 categories', () => {
    expect(TOOL_META).toHaveLength(13);
    expect(CATEGORIES).toHaveLength(5);
    TOOL_META.forEach((t) => expect(CATEGORIES).toContain(t.category));
  });
  it('marks the same five tools as free that the backend does', () => {
    expect(TOOL_META.filter((t) => t.free).map((t) => t.id).sort()).toEqual(['agent', 'code', 'pdf', 'resume', 'writer']);
  });
  it('builds routes and names', () => {
    expect(toolPath('tts')).toBe('/app/tools/text-to-speech');
    expect(toolName('image-to-text')).toBe('Image → Text');
    expect(new Set(TOOL_META.map((t) => t.path)).size).toBe(13);
  });
});
