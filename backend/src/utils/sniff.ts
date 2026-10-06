/** Minimal magic-byte sniffing so uploads are validated by content, not by client-declared MIME. */
export const sniffMime = (b: Buffer): string | null => {
  if (b.length < 12) return null;
  const hex = (s: number, e: number) => b.subarray(s, e).toString('hex');
  const ascii = (s: number, e: number) => b.subarray(s, e).toString('latin1');
  if (ascii(0, 4) === '%PDF') return 'application/pdf';
  if (hex(0, 8) === '89504e470d0a1a0a') return 'image/png';
  if (hex(0, 3) === 'ffd8ff') return 'image/jpeg';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (ascii(0, 3) === 'GIF') return 'image/gif';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WAVE') return 'audio/wav';
  if (ascii(0, 3) === 'ID3' || hex(0, 2) === 'fffb' || hex(0, 2) === 'fff3') return 'audio/mpeg';
  if (ascii(0, 4) === 'OggS') return 'audio/ogg';
  if (ascii(0, 4) === 'fLaC') return 'audio/flac';
  if (hex(0, 4) === '1a45dfa3') return 'video/webm';
  if (ascii(4, 8) === 'ftyp') return ascii(8, 12).startsWith('M4A') ? 'audio/mp4' : 'video/mp4';
  return null;
};

export const isTextLike = (b: Buffer): boolean => {
  const sample = b.subarray(0, 4096);
  for (const byte of sample) if (byte === 0) return false;
  return true;
};

export const IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp'];
export const AUDIO_MIMES = ['audio/wav', 'audio/mpeg', 'audio/ogg', 'audio/flac', 'audio/mp4', 'video/webm', 'video/mp4'];
export const VIDEO_MIMES = ['video/mp4', 'video/webm'];
export const EXT: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif',
  'audio/wav': 'wav', 'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'audio/flac': 'flac', 'audio/mp4': 'm4a',
  'video/webm': 'webm', 'video/mp4': 'mp4', 'application/pdf': 'pdf',
};
