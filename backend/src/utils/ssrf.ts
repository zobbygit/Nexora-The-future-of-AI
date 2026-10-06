import dns from 'dns/promises';
import net from 'net';
import { badRequest } from './errors';

const isPrivateIPv4 = (ip: string): boolean => {
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 10 || a === 127 || a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
};

export const isPrivateIp = (ip: string): boolean => {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();
    if (l === '::1' || l === '::' || l.startsWith('fe80') || l.startsWith('fc') || l.startsWith('fd')) return true;
    if (l.startsWith('::ffff:')) return isPrivateIPv4(l.slice(7));
    return false;
  }
  return true;
};

/** Validates that a user-supplied URL is public http(s) before the server fetches it. */
export const assertSafeUrl = async (raw: string): Promise<URL> => {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw badRequest('That URL is not valid.', 'INVALID_URL');
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw badRequest('Only http(s) URLs are allowed.', 'INVALID_URL');
  if (url.username || url.password) throw badRequest('URLs with credentials are not allowed.', 'INVALID_URL');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
    throw badRequest('That address is not allowed.', 'SSRF_BLOCKED');
  }
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) {
    throw badRequest('That address is not allowed.', 'SSRF_BLOCKED');
  }
  return url;
};

/** Fetch with SSRF guard, size cap, timeout and no redirects into private space. */
export const safeFetchBuffer = async (raw: string, maxBytes = 10 * 1024 * 1024): Promise<Buffer> => {
  let current = await assertSafeUrl(raw);
  for (let i = 0; i < 3; i++) {
    const res = await fetch(current, { redirect: 'manual', signal: AbortSignal.timeout(10000) });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      current = await assertSafeUrl(new URL(res.headers.get('location')!, current).toString());
      continue;
    }
    if (!res.ok) throw badRequest('Could not download that file.', 'FETCH_FAILED');
    const len = Number(res.headers.get('content-length') || 0);
    if (len > maxBytes) throw badRequest('That file is too large.', 'FILE_TOO_LARGE');
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > maxBytes) throw badRequest('That file is too large.', 'FILE_TOO_LARGE');
    return buf;
  }
  throw badRequest('Too many redirects.', 'FETCH_FAILED');
};
