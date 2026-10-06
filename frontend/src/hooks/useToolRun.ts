import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import type { Bootstrap, RunResult } from '@/lib/types';
import { errorCode, errorMessage } from '@/lib/utils';

export type RunState = 'idle' | 'running' | 'done' | 'error';

/** Runs a tool request, tracks live status from the socket, and keeps credits/history caches fresh. */
export const useToolRun = () => {
  const qc = useQueryClient();
  const [state, setState] = useState<RunState>('idle');
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [status, setStatus] = useState('');
  const last = useRef<(() => Promise<unknown>) | null>(null);

  useEffect(() => {
    const s = getSocket('user');
    const on = (p: { label: string }) => setStatus(p.label);
    s.on('generation:progress', on);
    return () => { s.off('generation:progress', on); };
  }, []);

  const run = useCallback(async (path: string, body: unknown) => {
    const exec = async () => {
      setState('running'); setError(null); setStatus('Starting');
      try {
        const { data } = await api.post<RunResult>(path, body, body instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined);
        setResult(data); setState('done');
        qc.setQueryData<Bootstrap>(['bootstrap'], (b) => (b ? { ...b, credits: data.creditsRemaining } : b));
        qc.invalidateQueries({ queryKey: ['history'] }); qc.invalidateQueries({ queryKey: ['artifacts'] }); qc.invalidateQueries({ queryKey: ['dashboard'] });
        return data;
      } catch (e) {
        setError({ message: errorMessage(e), code: errorCode(e) }); setState('error');
        if (errorCode(e) === 'INSUFFICIENT_CREDITS') qc.invalidateQueries({ queryKey: ['bootstrap'] });
        return null;
      }
    };
    last.current = exec;
    return exec();
  }, [qc]);

  const retry = useCallback(() => { void last.current?.(); }, []);
  const reset = useCallback(() => { setState('idle'); setResult(null); setError(null); }, []);
  return { state, result, error, status, run, retry, reset, running: state === 'running' };
};
