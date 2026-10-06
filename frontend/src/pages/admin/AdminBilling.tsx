import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Badge, ErrorState, Input, Pagination, Select, Skeleton, Switch, Tabs } from '@/components/ui/primitives';
import { Card, PageHeader, SectionTitle } from '@/components/shared/Bits';
import { api } from '@/lib/api';
import { errorMessage, formatDate, formatInr } from '@/lib/utils';
import { toast } from '@/store/ui';
import { DataTable, Stat } from './adminKit';

export default function AdminBilling() {
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') || 'payments';
  const [page, setPage] = useState(1);
  const bill = useQuery({ queryKey: ['admin-billing', page], queryFn: async () => (await api.get('/admin/billing', { params: { page, limit: 20 } })).data, placeholderData: (p) => p });
  const tx = useQuery({ queryKey: ['admin-tx'], enabled: tab === 'credits', queryFn: async () => (await api.get('/admin/transactions', { params: { limit: 50 } })).data });
  if (bill.error) return <ErrorState message={errorMessage(bill.error)} onRetry={() => bill.refetch()} />;
  const d = bill.data;
  return (
    <div className="space-y-6">
      <PageHeader title="Billing" eyebrow="Admin" subtitle="Subscriptions, payments, credits and plan configuration." actions={d && <Badge tone={d.stripe.enabled ? 'ok' : 'warn'}>{d.stripe.enabled ? `Stripe ${d.stripe.mode} mode` : 'Stripe not configured'}</Badge>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Stat label="Revenue (all time)" value={d ? formatInr(d.metrics.revenue) : '–'} sub={d ? `${formatInr(d.metrics.revenueLast30)} last 30 days` : ''} /><Stat label="Active subscriptions" value={d?.metrics.activeSubscriptions ?? '–'} /><Stat label="Cancelled" value={d?.metrics.cancelledSubscriptions ?? '–'} /><Stat label="Pro users" value={d?.metrics.proUsers ?? '–'} /></div>
      <Tabs tabs={[{ id: 'payments', label: 'Payments' }, { id: 'subscriptions', label: 'Subscriptions' }, { id: 'credits', label: 'Credit transactions' }, { id: 'plans', label: 'Plans & credits' }]} value={tab} onChange={(v) => setSp({ tab: v }, { replace: true })} />
      {tab === 'payments' && <><DataTable loading={bill.isLoading} head={['Date', 'User', 'Description', 'Amount', 'Status']} rows={(d?.payments || []).map((p: any) => [formatDate(p.createdAt), p.user?.name || '—', p.description, formatInr(p.amount), <Badge key="s" tone={p.status === 'paid' ? 'ok' : 'bad'}>{p.status}</Badge>])} empty="No payments yet." /><Pagination page={page} pages={d?.pages || 1} onChange={setPage} /></>}
      {tab === 'subscriptions' && <DataTable loading={bill.isLoading} head={['User', 'Status', 'Renews / ends', 'Started', 'Last event']} rows={(d?.subscriptions || []).map((s: any) => [s.user?.name || '—', <Badge key="s" tone={s.status === 'active' ? 'ok' : s.status === 'canceled' ? 'neutral' : 'warn'}>{s.status}{s.cancelAtPeriodEnd && ' · cancelling'}</Badge>, s.currentPeriodEnd ? formatDate(s.currentPeriodEnd) : '—', formatDate(s.createdAt).split(',')[0], s.history?.slice(-1)[0]?.event?.replace(/_/g, ' ') || '—'])} empty="No subscriptions yet." />}
      {tab === 'credits' && <DataTable loading={tx.isLoading} head={['When', 'User', 'Type', 'Change', 'Balance', 'Reason']} rows={(tx.data?.items || []).map((t: any) => [formatDate(t.timestamp), t.user?.name || '—', t.type.replace('_', ' ').toLowerCase(), <b key="a" className={t.amount < 0 ? 'text-bad' : 'text-ok'}>{t.amount > 0 ? '+' : ''}{t.amount}</b>, t.balanceAfter, t.reason])} empty="No transactions." />}
      {tab === 'plans' && <PlansEditor />}
    </div>
  );
}

const PlansEditor = () => {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-plans'], queryFn: async () => (await api.get('/admin/plans')).data });
  const [free, setFree] = useState(0);
  const [pro, setPro] = useState(0);
  const [tools, setTools] = useState<Record<string, { credits: number; plan: string; enabled: boolean }>>({});
  useEffect(() => { if (data) { setFree(data.plans.free.creditsPerPeriod); setPro(data.plans.pro.creditsPerPeriod); setTools(Object.fromEntries(data.tools.map((t: any) => [t.id, { credits: t.credits, plan: t.plan, enabled: t.enabled }]))); } }, [data]);
  const save = useMutation({ mutationFn: async () => api.put('/admin/plans', { plans: { free: { creditsPerPeriod: Number(free) }, pro: { creditsPerPeriod: Number(pro) } }, tools: Object.fromEntries(Object.entries(tools).map(([k, v]) => [k, { credits: Number(v.credits), plan: v.plan, enabled: v.enabled }])) }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-plans'] }); toast.success('Saved', 'New values apply to the next generation and credit refill.'); }, onError: (e) => toast.error('Could not save', errorMessage(e)) });
  if (isLoading || !data) return <Skeleton className="h-96" />;
  return (
    <div className="space-y-6">
      <Card><SectionTitle>Credit allowances</SectionTitle><div className="grid max-w-xl gap-4 sm:grid-cols-2"><label className="space-y-1.5 text-sm font-semibold text-fg-soft">Free · credits per day<Input type="number" min={0} value={free} onChange={(e) => setFree(Number(e.target.value))} /></label><label className="space-y-1.5 text-sm font-semibold text-fg-soft">Pro · credits per month<Input type="number" min={0} value={pro} onChange={(e) => setPro(Number(e.target.value))} /></label></div><p className="mt-3 text-xs text-fg-mute">Pro price is ₹400/month and is defined by the Stripe price. Allowances apply at each user’s next refill.</p></Card>
      <Card className="!p-0 overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-white/[0.03] text-[11px] uppercase tracking-wider text-fg-mute"><tr>{['Tool', 'Category', 'Credit cost', 'Plan access', 'Enabled'].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
        <tbody>{data.tools.map((t: any) => { const v = tools[t.id]; if (!v) return null; return <tr key={t.id} className="border-t border-line"><td className="px-4 py-2.5 font-semibold text-fg">{t.name}</td><td className="px-4 py-2.5 text-fg-mute">{t.category}</td>
          <td className="px-4 py-2.5"><Input type="number" min={0} max={1000} value={v.credits} onChange={(e) => setTools({ ...tools, [t.id]: { ...v, credits: Number(e.target.value) } })} className="!w-24 !py-1.5" aria-label={`${t.name} cost`} /></td>
          <td className="px-4 py-2.5"><Select value={v.plan} onChange={(e) => setTools({ ...tools, [t.id]: { ...v, plan: e.target.value } })} className="!w-28 !py-1.5" aria-label={`${t.name} plan`}><option value="free">Free</option><option value="pro">Pro</option></Select></td>
          <td className="px-4 py-2.5"><Switch checked={v.enabled} onChange={(e) => setTools({ ...tools, [t.id]: { ...v, enabled: e } })} label={`${t.name} enabled`} /></td></tr>; })}</tbody></table></div></Card>
      <div className="flex justify-end"><Button size="lg" onClick={() => save.mutate()} loading={save.isPending}>Save changes</Button></div>
    </div>
  );
};
