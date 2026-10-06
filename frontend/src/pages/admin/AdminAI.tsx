import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge, ErrorState, Input, Modal, Pagination, Select, Skeleton, Tabs } from '@/components/ui/primitives';
import { PageHeader } from '@/components/shared/Bits';
import { api } from '@/lib/api';
import { TOOL_META, toolName } from '@/lib/tools';
import { cn, errorMessage, formatDate, timeAgo } from '@/lib/utils';
import { DataTable, Stat } from './adminKit';

const TONE = { healthy: 'ok', degraded: 'warn', unavailable: 'bad' } as const;

export const ProviderCards = ({ providers, loading }: { providers?: any[]; loading?: boolean }) => (
  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
    {loading || !providers ? Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-40" />) : providers.map((p) => (
      <div key={p.provider} className="surface p-5">
        <div className="flex items-center justify-between"><p className="font-bold">{p.label}</p><Badge tone={TONE[p.status as keyof typeof TONE]}><span className={cn('h-1.5 w-1.5 rounded-full', p.status === 'healthy' ? 'bg-ok' : p.status === 'degraded' ? 'bg-warn' : 'bg-bad')} />{p.status}</Badge></div>
        <dl className="mt-4 space-y-1.5 text-xs"><div className="flex justify-between"><dt className="text-fg-mute">Requests</dt><dd className="font-semibold">{p.requests}</dd></div><div className="flex justify-between"><dt className="text-fg-mute">Success rate</dt><dd className="font-semibold">{p.successRate ?? '—'}{p.successRate != null && '%'}</dd></div><div className="flex justify-between"><dt className="text-fg-mute">Avg latency</dt><dd className="font-semibold">{p.avgLatencyMs ? `${p.avgLatencyMs} ms` : '—'}</dd></div><div className="flex justify-between"><dt className="text-fg-mute">Fallbacks from</dt><dd className="font-semibold">{p.fallbacksFrom}</dd></div></dl>
        {!p.configured && <p className="mt-3 rounded-lg bg-bad/10 px-2 py-1 text-[11px] text-bad">API key not configured</p>}
        {p.lastError && <p className="mt-3 line-clamp-2 text-[11px] text-fg-faint" title={p.lastError}>Last error {timeAgo(p.lastErrorAt)}: {p.lastError}</p>}
      </div>))}
  </div>
);

export default function AdminAI() {
  const [sp] = useSearchParams();
  const [tab, setTab] = useState('overview');
  const [f, setF] = useState({ q: sp.get('q') || '', tool: '', status: '', provider: '', fallback: false });
  const [dq, setDq] = useState(f.q);
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState<any>(null);
  useEffect(() => { if (sp.get('q')) setTab('generations'); }, [sp]);
  useEffect(() => { const t = setTimeout(() => { setDq(f.q); setPage(1); }, 300); return () => clearTimeout(t); }, [f.q]);
  const ov = useQuery({ queryKey: ['admin-ai'], queryFn: async () => (await api.get('/admin/ai')).data, refetchInterval: 30_000 });
  const gens = useQuery({ queryKey: ['admin-gens', dq, f.tool, f.status, f.provider, f.fallback, page], enabled: tab === 'generations', queryFn: async () => (await api.get('/admin/generations', { params: { q: dq || undefined, tool: f.tool || undefined, status: f.status || undefined, provider: f.provider || undefined, fallback: f.fallback || undefined, page, limit: 20 } })).data, placeholderData: (p) => p });
  if (ov.error) return <ErrorState message={errorMessage(ov.error)} onRetry={() => ov.refetch()} />;
  const d = ov.data;
  return (
    <div className="space-y-6">
      <PageHeader title="AI Management" eyebrow="Admin" subtitle="Provider health, tool usage, fallback behavior and failed generations." />
      {d?.mock && <div className="rounded-2xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">AI_MOCK is enabled — providers return simulated output.</div>}
      <Tabs tabs={[{ id: 'overview', label: 'Overview' }, { id: 'generations', label: 'Generations' }, { id: 'errors', label: 'Failed generations' }]} value={tab} onChange={setTab} />
      {tab === 'overview' && (<>
        <ProviderCards providers={d?.providers} loading={ov.isLoading} />
        <div className="grid gap-4 sm:grid-cols-3"><Stat label="Total generations" value={d?.totals.generations ?? '–'} /><Stat label="Failed" value={d?.totals.failed ?? '–'} tone={d?.totals.failed ? 'bad' : undefined} /><Stat label="Fallback events" value={d?.totals.fallbackEvents ?? '–'} tone={d?.totals.fallbackEvents ? 'warn' : undefined} sub="Generations that needed a second provider" /></div>
        <div><p className="mb-3 text-[17px] font-bold">Tool usage</p><DataTable loading={ov.isLoading} head={['Tool', 'Generations', 'Failed', 'Credits', 'Avg latency']} rows={(d?.tools || []).map((t: any) => [toolName(t.tool), t.count, t.failed || '—', t.credits, `${t.avgLatencyMs} ms`])} empty="No generations yet." /></div></>)}
      {tab === 'generations' && (<>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Input placeholder="Search title…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} aria-label="Search" />
          <Select value={f.tool} onChange={(e) => { setF({ ...f, tool: e.target.value }); setPage(1); }} aria-label="Tool"><option value="">All tools</option>{TOOL_META.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
          <Select value={f.status} onChange={(e) => { setF({ ...f, status: e.target.value }); setPage(1); }} aria-label="Status"><option value="">Any status</option><option value="completed">Completed</option><option value="failed">Failed</option></Select>
          <Select value={f.provider} onChange={(e) => { setF({ ...f, provider: e.target.value }); setPage(1); }} aria-label="Provider"><option value="">All providers</option>{['openrouter', 'groq', 'huggingface', 'cloudflare', 'clipdrop'].map((p) => <option key={p} value={p}>{p}</option>)}</Select>
          <label className="flex items-center gap-2 text-sm text-fg-soft"><input type="checkbox" checked={f.fallback} onChange={(e) => { setF({ ...f, fallback: e.target.checked }); setPage(1); }} className="accent-violet-500" />Fallback used</label></div>
        <DataTable loading={gens.isLoading} onRow={(i) => setSel(gens.data.items[i])} head={['Tool', 'Title', 'User', 'Provider', 'Status', 'Latency', 'When']} rows={(gens.data?.items || []).map((g: any) => [toolName(g.tool), <span key="t" className="block max-w-[220px] truncate">{g.title}</span>, g.user?.name || '—', <span key="p" className="capitalize">{g.provider || '—'}{g.fallbackUsed && ' ↩'}</span>, <Badge key="s" tone={g.status === 'completed' ? 'ok' : 'bad'}>{g.status}</Badge>, g.latency ? `${g.latency}ms` : '—', timeAgo(g.createdAt)])} />
        <Pagination page={page} pages={gens.data?.pages || 1} onChange={setPage} /></>)}
      {tab === 'errors' && <DataTable loading={ov.isLoading} head={['Tool', 'User', 'Provider', 'Error', 'When']} rows={(d?.errors || []).map((g: any) => [toolName(g.tool), g.user || '—', g.provider || '—', <span key="e" className="block max-w-[360px] truncate text-bad" title={g.error}>{g.error || 'Unknown error'}</span>, timeAgo(g.createdAt)])} empty="No failed generations. 🎉" />}
      <Modal open={!!sel} onClose={() => setSel(null)} title={sel ? toolName(sel.tool) : ''} description={sel ? `${sel.user?.name || 'Unknown'} · ${formatDate(sel.createdAt)}` : ''} width="max-w-xl">
        {sel && <div className="space-y-4 text-sm"><div className="grid grid-cols-2 gap-3">{[['Status', sel.status], ['Provider', sel.provider || '—'], ['Model', sel.model || '—'], ['Credits', sel.creditsUsed], ['Latency', sel.latency ? `${sel.latency} ms` : '—'], ['Fallback', sel.fallbackUsed ? 'Yes' : 'No']].map(([k, v]) => <div key={k as string} className="rounded-xl border border-line bg-white/[0.03] px-3 py-2"><p className="text-xs text-fg-mute">{k}</p><p className="font-semibold capitalize">{v}</p></div>)}</div>
          {sel.error && <p className="rounded-xl bg-bad/10 px-3 py-2 text-bad">{sel.error}</p>}
          <div><p className="label mb-2">Provider attempts</p><ul className="space-y-1.5">{(sel.attempts || []).map((a: any, i: number) => <li key={i} className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2 text-xs"><span className="capitalize">{a.provider}</span><span className={a.ok ? 'text-ok' : 'text-bad'}>{a.ok ? 'ok' : (a.error || 'failed').slice(0, 60)} · {a.latencyMs}ms</span></li>)}{!sel.attempts?.length && <li className="text-fg-mute">No attempts recorded.</li>}</ul></div></div>}
      </Modal>
    </div>
  );
}
