import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_URL } from '@/lib/env';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
  headers: { 'X-Nexora-Client': 'web' },
  timeout: 120000,
});

let refreshing: Promise<void> | null = null;
type Retryable = InternalAxiosRequestConfig & { _retry?: boolean };

/** Silently refreshes the short-lived access cookie once, then replays the failed request. */
api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError<{ error?: { code?: string } }>) => {
    const original = error.config as Retryable | undefined;
    const code = error.response?.data?.error?.code;
    const isAuthCall = original?.url?.startsWith('/auth/') || original?.url?.startsWith('/admin/');
    if (error.response?.status === 401 && code === 'TOKEN_EXPIRED' && original && !original._retry && !isAuthCall) {
      original._retry = true;
      refreshing ||= api.post('/auth/refresh').then(() => undefined).finally(() => { refreshing = null; });
      try { await refreshing; return api(original); } catch { window.dispatchEvent(new Event('nexora:session-expired')); }
    }
    if (error.response?.status === 401 && ['SESSION_REVOKED', 'UNAUTHORIZED'].includes(code || '') && !isAuthCall) {
      window.dispatchEvent(new Event('nexora:session-expired'));
    }
    return Promise.reject(error);
  },
);

export const fileUrl = (url?: string) => (!url ? '' : url.startsWith('http') || url.startsWith('data:') ? url : `${API_URL}${url}`);
