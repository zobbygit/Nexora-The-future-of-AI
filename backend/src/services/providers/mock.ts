import { AdapterInput, AdapterResult } from './types';
import { ProviderName } from '../../config/tools';

const wav = (seconds = 1.2, freq = 440): Buffer => {
  const rate = 16000, n = Math.floor(rate * seconds);
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const env = Math.min(1, i / 800, (n - i) / 800);
    buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * freq * i) / rate) * 9000 * env), 44 + i * 2);
  }
  return buf;
};

const svg = (label: string, w = 1024, h = 1024) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b1140"/><stop offset=".55" stop-color="#5b3bd6"/><stop offset="1" stop-color="#22d3ee"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><circle cx="${w * 0.7}" cy="${h * 0.3}" r="${h * 0.18}" fill="#fff" opacity=".12"/><text x="50%" y="52%" text-anchor="middle" fill="#fff" font-family="sans-serif" font-size="${Math.round(w / 22)}" opacity=".9">${label.replace(/[<&>]/g, '').slice(0, 60)}</text></svg>`,
  );

/** Deterministic hashing embedder — also the real fallback used by RAG when no embedding provider is reachable. */
export const localEmbed = (text: string, dims = 384): number[] => {
  const v = new Array(dims).fill(0);
  const tokens = text.toLowerCase().match(/[a-z0-9]{2,}/g) || [];
  for (const t of tokens) {
    let h = 2166136261;
    for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
    v[Math.abs(h) % dims] += (h & 1) === 0 ? 1 : -1;
  }
  const norm = Math.sqrt(v.reduce((a, b) => a + b * b, 0)) || 1;
  return v.map((x) => x / norm);
};

export const mockRun = (provider: ProviderName, input: AdapterInput): AdapterResult => {
  const model = `${provider}-mock`;
  switch (input.capability) {
    case 'text.generate': {
      const last = [...(input.messages || [])].reverse().find((m) => m.role === 'user')?.content || '';
      const wantsJson = /Respond ONLY with (valid )?JSON/i.test(input.messages?.[0]?.content || '');
      if (wantsJson) return { provider, model, text: '{"steps":[{"action":"answer","input":"Summarise the goal"}]}' };
      const gist = last.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
      return { provider, model, text: `# Simulated response\n\nThis is a development-mode response from **${provider}**.\n\n> ${gist || 'No prompt supplied.'}\n\n- Point one, generated locally\n- Point two, generated locally\n\nSet real provider keys and \`AI_MOCK=false\` for live output.` };
    }
    case 'vision.ocr': return { provider, model, text: 'Simulated extracted text.\nLine two of the image.' };
    case 'speech.stt':
    case 'video.stt':
      return { provider, model, text: 'This is a simulated transcript of your recording.', segments: [
        { start: 0, end: 2.4, text: 'This is a simulated transcript' }, { start: 2.4, end: 4.1, text: 'of your recording.' },
      ] };
    case 'speech.tts': return { provider, model, buffer: wav(), mime: 'audio/wav' };
    case 'image.generate': return { provider, model, buffer: svg(input.prompt || 'Nexora', input.options?.width, input.options?.height), mime: 'image/svg+xml' };
    case 'image.removeBg':
    case 'image.enhance':
      return { provider, model, buffer: input.image!.buffer, mime: input.image!.mime };
    case 'embeddings': {
      const arr = Array.isArray(input.text) ? input.text : [input.text || ''];
      return { provider, model, embeddings: arr.map((t) => localEmbed(t)) };
    }
  }
};
