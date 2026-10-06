import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Download, Eye, FileDown, FileJson, Heart, History as HistoryIcon, Repeat, Search, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Badge, ConfirmModal, EmptyState, ErrorState, Input, Pagination, Select, Skeleton } from '@/components/ui/primitives';
import { PageHeader } from '@/components/shared/Bits';
import { api } from '@/lib/api';
import { TOOL_BY_ID, TOOL_META, toolName, toolPath } from '@/lib/tools';
import type { Generation } from '@/lib/types';
import { cn, downloadBlob, errorMessage, formatDate } from '@/lib/utils';
import { toast } from '@/store/ui';

export default function HistoryPage() {
  const qc = useQueryClient();
  const [f, setF] = useState({ q: '', tool: '', status: '', from: '', to: '', favorite: false });
  const [dq, setDq] = useState('');
  const [page, setPage] = useState(1);
  const [del, setDel] = useState<Generation | null>(null);
  useEffect(() => { const t = setTimeout(() => { setDq(f.q); setPage(1); }, 300); return () => clearTimeout(t); }, [f.q]);
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['history', dq, f.tool, f.status, f.from, f.to, f.favorite, page],
    queryFn: async () => (await api.get('/history', { params: { q: dq || undefined, tool: f.tool || undefined, status: f.status || undefined, from: f.from || undefined, to: f.to || undefined, favorite: f.favorite || undefined, page, limit: 15 } })).data as { items: Generation[]; total: number; pages: number },
    placeholderData: (p) => p,
  });
  const fav = useMutation({ mutationFn: async (g: Generation) => api.patch(`/history/${g.id}/favorite`, { favorite: !g.favorite }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['history'] }); qc.invalidateQueries({ queryKey: ['artifacts'] }); }, onError: (e) => toast.error('Could not update', errorMessage(e)) });
  const remove = useMutation({ mutationFn: async (id: string) => api.delete(`/history/${id}`), onSuccess: () => { setDel(null); qc.invalidateQueries({ queryKey: ['history'] }); toast.success('Removed from history'); }, onError: (e) => toast.error('Could not delete', errorMessage(e)) });
  const exp = useMutation({ mutationFn: async (fmt: 'pdf' | 'json') => ({ fmt, blob: (await api.get(`/history/export/${fmt}`, { responseType: 'blob' })).data as Blob }), onSuccess: ({ fmt, blob }) => { downloadBlob(blob, `nexora-history.${fmt}`); toast.success('Export ready', `History exported as ${fmt.toUpperCase()}.`); }, onError: () => toast.error('Export failed', 'Please try again.') });
  const set = (p: Partial<typeof f>) => { setF((s) => ({ ...s, ...p })); setPage(1); };
  const filtered = !!(f.q || f.tool || f.status || f.from || f.to || f.favorite);
  return (
    <div>
      <PageHeader title="History" subtitle="Every generation you have run, with credits, provider and status."
        actions={<><Button variant="secondary" onClick={() => exp.mutate('pdf')} loading={exp.isPending && exp.variables === 'pdf'}><FileDown className="h-4 w-4" />Export PDF</Button><Button variant="secondary" onClick={() => exp.mutate('json')} loading={exp.isPending && exp.variables === 'json'}><FileJson className="h-4 w-4" />Export JSON</Button></>} />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_180px_150px_150px_150px_auto]">
        <div className="relative"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-mute" /><Input className="pl-10" placeholder="Search history…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} aria-label="Search history" /></div>
        <Select value={f.tool} onChange={(e) => set({ tool: e.target.value })} aria-label="Tool"><option value="">All tools</option>{TOOL_META.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
        <Select value={f.status} onChange={(e) => set({ status: e.target.value })} aria-label="Status"><option value="">Any status</option><option value="completed">Completed</option><option value="failed">Failed</option></Select>
        <Input type="date" value={f.from} onChange={(e) => set({ from: e.target.value })} aria-label="From date" /><Input type="date" value={f.to} onChange={(e) => set({ to: e.target.value })} aria-label="To date" />
        <Button variant={f.favorite ? 'primary' : 'secondary'} onClick={() => set({ favorite: !f.favorite })} aria-pressed={f.favorite}><Heart className={cn('h-4 w-4', f.favorite && 'fill-current')} />Favorites</Button>
      </div>
      {filtered && <button onClick={() => { setF({ q: '', tool: '', status: '', from: '', to: '', favorite: false }); setPage(1); }} className="mb-4 text-sm font-semibold text-violet-300 hover:text-violet-200">Clear filters</button>}
      {error ? <ErrorState message={errorMessage(error)} onRetry={() => refetch()} /> : isLoading ? <div className="space-y-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[72px]" />)}</div> : !data?.items.length ? (
        <EmptyState icon={<HistoryIcon className="h-6 w-6" />} title={filtered ? 'No results' : 'No generations yet'} body={filtered ? 'Try adjusting your filters.' : 'Run any tool and it will be recorded here.'} action={!filtered && <Button asChild><Link to="/app/tools">Explore tools</Link></Button>} />
      ) : (
        <div className={cn('space-y-2.5 transition-opacity', isFetching && 'opacity-60')}>
          {data.items.map((g, i) => { const t = TOOL_BY_ID[g.tool]; return (
            <motion.div key={g.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.025 }} className="surface flex flex-wrap items-center gap-4 p-3.5 sm:flex-nowrap">
              <span className={cn('grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br', t?.tile || 'from-violet-500 to-indigo-500')}>{t && <t.icon className="h-5 w-5" />}</span>
              <div className="min-w-0 flex-1"><p className="truncate font-bold">{g.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-mute"><span>{toolName(g.tool)}</span><span>{formatDate(g.createdAt)}</span><span>{g.creditsUsed} credits</span>{g.provider && <span className="capitalize">{g.provider}{g.fallbackUsed && ' (fallback)'}</span>}</div></div>
              <Badge tone={g.status === 'completed' ? 'ok' : 'bad'}>{g.status === 'completed' ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}{g.status}</Badge>
              <div className="flex items-center gap-1">
                {g.artifactId && <Button asChild size="icon" variant="ghost" aria-label="View"><Link to={`/app/workspace?artifact=${g.artifactId}`}><Eye className="h-4 w-4" /></Link></Button>}
                {g.artifactId && <Button asChild size="icon" variant="ghost" aria-label="Download"><Link to={`/app/workspace?artifact=${g.artifactId}`}><Download className="h-4 w-4" /></Link></Button>}
                <Button asChild size="icon" variant="ghost" aria-label="Run again"><Link to={toolPath(g.tool)}><Repeat className="h-4 w-4" /></Link></Button>
                <Button size="icon" variant="ghost" onClick={() => fav.mutate(g)} aria-label={g.favorite ? 'Unfavorite' : 'Favorite'} aria-pressed={g.favorite}><Heart className={cn('h-4 w-4', g.favorite && 'fill-rose-400 text-rose-400')} /></Button>
                <Button size="icon" variant="ghost" onClick={() => setDel(g)} aria-label="Delete" className="hover:!text-bad"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </motion.div>); })}
          <Pagination page={page} pages={data.pages} onChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
        </div>)}
      <ConfirmModal open={!!del} onClose={() => setDel(null)} onConfirm={() => del && remove.mutate(del.id)} loading={remove.isPending} danger title="Delete from history?" body="This removes the record of this generation. Any file it created stays in your workspace." confirmLabel="Delete" />
    </div>
  );
}
