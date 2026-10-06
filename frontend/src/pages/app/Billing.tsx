import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { AlertTriangle, Check, CreditCard, ExternalLink, Lock, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Badge, ConfirmModal, ErrorState, Skeleton, Tabs } from '@/components/ui/primitives';
import { Card, PageHeader, SectionTitle } from '@/components/shared/Bits';
import { Tilt } from '@/components/ui/Tilt';
import { api } from '@/lib/api';
import { cn, errorMessage, formatCountdown, formatDate, formatInr, formatNumber } from '@/lib/utils';
import { toast } from '@/store/ui';

interface Overview {
  plan: 'free' | 'pro'; credits: number; resetsAt?: string; plans: Record<string, { name: string; priceInr: number; creditsPerPeriod: number; period: string }>;
  subscription: { id: string; status: string; cancelAtPeriodEnd: boolean; currentPeriodEnd?: string } | null; billingStatus: 'none' | 'active' | 'cancelling' | 'payment_failed';
  subscriptions: { id: string; status: string; createdAt: string; history: { event: string; status: string; at: string }[] }[];
  payments: { id: string; amount: number; currency: string; status: string; description: string; receiptUrl?: string; createdAt: string }[]; stripe: { enabled: boolean; mode: string; webhook?: boolean; missing?: string[] };
}
const FEATURES = [['AI Writer, Resume & Cover, Code, PDF AI, Agent', true, true], ['Audio, Vision, Image & Video tools', false, true], ['Data Analyzer', false, true], ['Workspace & collaboration', true, true]] as const;

export default function Billing() {
  const qc = useQueryClient();
  const [sp, setSp] = useSearchParams();
  const [tab, setTab] = useState('plan');
  const [cancel, setCancel] = useState(false);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['billing'], queryFn: async () => (await api.get<Overview>('/billing')).data });
  const { data: credits } = useQuery({ queryKey: ['credits'], queryFn: async () => (await api.get('/credits', { params: { limit: 30 } })).data.transactions as { id: string; type: string; amount: number; balanceAfter: number; reason: string; timestamp: string }[] });
  const inv = () => { qc.invalidateQueries({ queryKey: ['billing'] }); qc.invalidateQueries({ queryKey: ['bootstrap'] }); qc.invalidateQueries({ queryKey: ['credits'] }); };
  const sync = useMutation({
    mutationFn: async (sessionId?: string) => (await api.post('/billing/sync', { sessionId })).data as { plan: string; synced: number },
    onSuccess: (r) => { inv(); qc.invalidateQueries({ queryKey: ['bootstrap'] }); if (r.plan === 'pro') toast.success('You are on Nexora Pro', 'All tools are unlocked.'); else toast.info('No active subscription found', 'If you just paid, wait a few seconds and try again.'); },
    onError: (e) => toast.error('Could not refresh billing', errorMessage(e)),
  });
  useEffect(() => {
    const c = sp.get('checkout');
    if (!c) return;
    const sessionId = sp.get('session_id') || undefined;
    sp.delete('checkout'); sp.delete('session_id'); setSp(sp, { replace: true });
    if (c === 'success') {
      toast.success('Payment received', 'Activating your Pro plan…');
      // Ask the server to confirm with Stripe directly — works even before the webhook is delivered.
      sync.mutate(sessionId);
      let n = 0; const t = setInterval(() => { inv(); if (++n > 6) clearInterval(t); }, 2500);
      return () => clearInterval(t);
    }
    toast.info('Checkout cancelled', 'You have not been charged.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const checkout = useMutation({ mutationFn: async () => (await api.post('/billing/checkout')).data.url as string, onSuccess: (u) => { window.location.href = u; }, onError: (e) => toast.error('Checkout unavailable', errorMessage(e)) });
  const portal = useMutation({ mutationFn: async () => (await api.post('/billing/portal')).data.url as string, onSuccess: (u) => { window.location.href = u; }, onError: (e) => toast.error('Could not open billing portal', errorMessage(e)) });
  const cancelSub = useMutation({ mutationFn: async () => api.post('/billing/cancel'), onSuccess: () => { setCancel(false); inv(); toast.success('Subscription will end at the period close'); }, onError: (e) => toast.error('Could not cancel', errorMessage(e)) });
  const resume = useMutation({ mutationFn: async () => api.post('/billing/resume'), onSuccess: () => { inv(); toast.success('Subscription resumed'); }, onError: (e) => toast.error('Could not resume', errorMessage(e)) });
  if (error) return <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />;
  const pro = data?.plan === 'pro';
  const cap = data ? data.plans[data.plan].creditsPerPeriod : 1;
  const status = data?.billingStatus;
  return (
    <div>
      <PageHeader title="Billing" subtitle="Your plan, credits, subscription and payment history." />
      {isLoading || !data ? <Skeleton className="h-72" /> : (<>
        {status === 'payment_failed' && <div className="mb-6 flex items-center gap-3 rounded-2xl border border-bad/30 bg-bad/10 px-5 py-4 text-sm" role="alert"><AlertTriangle className="h-5 w-5 shrink-0 text-bad" /><span className="flex-1">Your last payment failed. Update your payment method to keep Pro.</span><Button size="sm" onClick={() => portal.mutate()} loading={portal.isPending}>Fix payment</Button></div>}
        <div className="grid gap-6 lg:grid-cols-5">
          <Tilt max={3} className={cn('relative overflow-hidden rounded-3xl border p-7 lg:col-span-3', pro ? 'border-amber-400/30 bg-gradient-to-br from-amber-400/[0.12] to-violet-500/[0.08]' : 'border-line bg-ink-800/80')}>
            <div className="flex items-start justify-between"><div><p className="label">Current plan</p><h2 className="mt-2 text-4xl font-extrabold tracking-tight">{pro ? 'Pro' : 'Free'}</h2><p className="mt-1 text-fg-mute">{pro ? `${formatInr(data.plans.pro.priceInr)} / month` : '₹0 · 20 credits / day'}</p></div>
              <Badge tone={status === 'cancelling' ? 'warn' : pro ? 'pro' : 'neutral'}>{status === 'cancelling' ? 'Cancelling' : status === 'payment_failed' ? 'Payment issue' : pro ? 'Active' : 'Free'}</Badge></div>
            <div className="mt-7"><div className="flex items-end justify-between"><p className="text-3xl font-extrabold">{formatNumber(data.credits)} <span className="text-sm font-medium text-fg-mute">credits available</span></p><p className="text-xs text-fg-mute">{pro ? 'Renews monthly' : `Resets in ${formatCountdown(data.resetsAt)}`}</p></div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-sky2" initial={{ width: 0 }} animate={{ width: `${Math.min(100, (data.credits / cap) * 100)}%` }} transition={{ duration: 0.9 }} /></div></div>
            {data.subscription?.currentPeriodEnd && <p className="mt-5 text-sm text-fg-soft">{status === 'cancelling' ? 'Access ends' : 'Next renewal'}: <b>{formatDate(data.subscription.currentPeriodEnd)}</b></p>}
            <div className="mt-6 flex flex-wrap gap-2">
              {!pro && <Button size="lg" onClick={() => checkout.mutate()} loading={checkout.isPending} disabled={!data.stripe.enabled}><Sparkles className="h-4 w-4" />Upgrade to Pro · ₹400/mo</Button>}
              {pro && status === 'cancelling' && <Button onClick={() => resume.mutate()} loading={resume.isPending}>Resume subscription</Button>}
              {pro && status !== 'cancelling' && data.subscription && <Button variant="danger" onClick={() => setCancel(true)}>Cancel subscription</Button>}
              {pro && data.subscription && <Button variant="secondary" onClick={() => portal.mutate()} loading={portal.isPending}><CreditCard className="h-4 w-4" />Payment method<ExternalLink className="h-3.5 w-3.5" /></Button>}
            </div>
            {!pro && !data.stripe.enabled && <p className="mt-3 text-xs text-fg-mute">Billing is not available yet.{data.stripe.missing?.length ? ` Server is missing: ${data.stripe.missing.join(', ')}.` : ''}</p>}
            {data.stripe.enabled && <button onClick={() => sync.mutate(undefined)} disabled={sync.isPending} className="mt-3 text-xs font-semibold text-violet-300 transition hover:text-violet-200 disabled:opacity-60">{sync.isPending ? 'Checking with Stripe…' : 'Paid already? Refresh my plan'}</button>}
            {data.stripe.mode === 'test' && data.stripe.enabled && <p className="mt-3 text-xs text-fg-faint">Stripe test mode — use card 4242 4242 4242 4242.</p>}
          </Tilt>
          <Card className="lg:col-span-2"><SectionTitle>Free vs Pro</SectionTitle>
            <div className="mb-3 grid grid-cols-[1fr_52px_52px] gap-2 text-center text-[11px] font-bold text-fg-mute"><span /><span>Free</span><span className="text-amber-300">Pro</span></div>
            <ul className="space-y-2.5">{FEATURES.map(([t, f, p]) => <li key={t} className="grid grid-cols-[1fr_52px_52px] items-center gap-2 text-sm"><span className="text-fg-soft">{t}</span>{[f, p].map((v, i) => <span key={i} className="grid place-items-center">{v ? <Check className="h-4 w-4 text-violet-300" /> : <Lock className="h-3.5 w-3.5 text-fg-faint" />}</span>)}</li>)}
              <li className="grid grid-cols-[1fr_52px_52px] gap-2 border-t border-line pt-3 text-sm"><span className="text-fg-soft">Credits</span><span className="text-center text-xs font-bold">20/day</span><span className="text-center text-xs font-bold text-amber-300">{formatNumber(data.plans.pro.creditsPerPeriod)}/mo</span></li></ul></Card>
        </div>
        <Tabs className="mb-5 mt-10" tabs={[{ id: 'plan', label: 'Credit usage' }, { id: 'subs', label: 'Subscription history' }, { id: 'pay', label: 'Payment history' }]} value={tab} onChange={setTab} />
        {tab === 'plan' && <Card className="!p-0 overflow-hidden"><Table head={['When', 'Type', 'Change', 'Balance', 'Note']} empty="No credit activity yet." rows={(credits || []).map((t) => [formatDate(t.timestamp), t.type.replace('_', ' ').toLowerCase(), <b key="a" className={t.amount < 0 ? 'text-bad' : 'text-ok'}>{t.amount > 0 ? '+' : ''}{t.amount}</b>, t.balanceAfter, t.reason])} /></Card>}
        {tab === 'subs' && <Card className="!p-0 overflow-hidden"><Table head={['Started', 'Status', 'Events']} empty="No subscriptions yet." rows={data.subscriptions.map((s) => [formatDate(s.createdAt), <Badge key="b" tone={s.status === 'active' ? 'ok' : s.status === 'canceled' ? 'neutral' : 'warn'}>{s.status}</Badge>, s.history.slice(-3).map((h) => h.event.replace(/_/g, ' ')).join(' → ')])} /></Card>}
        {tab === 'pay' && <Card className="!p-0 overflow-hidden"><Table head={['Date', 'Description', 'Amount', 'Status', 'Receipt']} empty="No payments yet." rows={data.payments.map((p) => [formatDate(p.createdAt), p.description, formatInr(p.amount), <Badge key="b" tone={p.status === 'paid' ? 'ok' : 'bad'}>{p.status}</Badge>, p.receiptUrl ? <a key="r" href={p.receiptUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-violet-300">View</a> : '—'])} /></Card>}
      </>)}
      <ConfirmModal open={cancel} onClose={() => setCancel(false)} onConfirm={() => cancelSub.mutate()} loading={cancelSub.isPending} danger title="Cancel Pro?" body="You keep Pro access until the end of the current billing period. You can resume any time before then." confirmLabel="Cancel subscription" />
    </div>
  );
}

const Table = ({ head, rows, empty }: { head: string[]; rows: React.ReactNode[][]; empty: string }) => !rows.length ? <p className="px-6 py-12 text-center text-sm text-fg-mute">{empty}</p> : (
  <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="bg-white/[0.03] text-[11px] uppercase tracking-wider text-fg-mute"><tr>{head.map((h) => <th key={h} className="px-5 py-3 font-semibold">{h}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i} className="border-t border-line transition hover:bg-white/[0.02]">{r.map((c, j) => <td key={j} className="px-5 py-3 capitalize-first text-fg-soft">{c}</td>)}</tr>)}</tbody></table></div>
);