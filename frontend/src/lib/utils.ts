import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const timeAgo = (input: string | Date | undefined): string => {
  if (!input) return '';
  const s = Math.max(0, Math.round((Date.now() - new Date(input).getTime()) / 1000));
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.round(s / 86400)}d ago`;
  return new Date(input).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

export const formatDate = (d?: string | Date) =>
  d ? new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export const formatBytes = (n = 0) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);
export const formatNumber = (n = 0) => new Intl.NumberFormat('en-IN').format(n);
export const formatInr = (n = 0) => `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)}`;

export const formatCountdown = (target?: string | Date): string => {
  if (!target) return '';
  const ms = Math.max(0, new Date(target).getTime() - Date.now());
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${String(m).padStart(2, '0')}m`;
};

export const errorMessage = (e: unknown, fallback = 'Something went wrong. Please try again.'): string => {
  const err = e as { response?: { data?: { error?: { message?: string } } }; message?: string };
  return err?.response?.data?.error?.message || (err?.message && !/Network Error|status code/.test(err.message) ? err.message : fallback);
};
export const errorCode = (e: unknown): string | undefined => (e as { response?: { data?: { error?: { code?: string } } } })?.response?.data?.error?.code;

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};
export const downloadText = (text: string, filename: string, type = 'text/plain') => downloadBlob(new Blob([text], { type }), filename);
export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'nexora';

export const copyText = async (text: string) => {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select();
    const ok = document.execCommand('copy'); t.remove(); return ok;
  }
};
