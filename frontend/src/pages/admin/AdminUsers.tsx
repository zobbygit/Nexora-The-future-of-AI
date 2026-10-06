import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Coins, Crown, Trash2, UserCheck, UserX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Avatar } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Badge, ConfirmModal, ErrorState, Field, Input, Modal, Pagination, Select, Skeleton, Tabs } from '@/components/ui/primitives';
import { PageHeader } from '@/components/shared/Bits';
import { api } from '@/lib/api';
import { toolName } from '@/lib/tools';
import { errorMessage, formatDate, formatNumber, timeAgo } from '@/lib/utils';
import { toast } from '@/store/ui';
import { DataTable, Stat } from './adminKit';

export function AdminUsers() {
  const nav = useNavigate();
  const [f, setF] = useState({ q: '', plan: '', status: '' });
  const [dq, setDq] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => { const t = setTimeout(() => { setDq(f.q); setPage(1); }, 300); return () => clearTimeout(t); }, [f.q]);
  const { data, isLoading, error, refetch, isFetching } = useQuery({ queryKey: ['admin-users', dq, f.plan, f.status, page], queryFn: async () => (await api.get('/admin/users', { params: { q: dq || undefined, plan: f.plan || undefined, status: f.status || undefined, page, limit: 20 } })).data, placeholderData: (p) => p });
  if (error) return <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />;
  return (
    <div>
      <PageHeader title="Users" eyebrow="Admin" subtitle={`${data?.total ?? '–'} accounts. Search, filter and open any user.`} />
      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_160px_160px]">
        <Input placeholder="Search name, email or phone…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} aria-label="Search users" />
   <Select value={f.plan} onChange={(e) => { setF({ ...f, plan: e.target.value }); setPage(1); }} aria-label="Plan">
  <option value="" style={{ backgroundColor: '#1c1c1e', color: '#ffffff' }}>All plans</option>
  <option value="free" style={{ backgroundColor: '#1c1c1e', color: '#ffffff' }}>Free</option>
  <option value="pro" style={{ backgroundColor: '#1c1c1e', color: '#ffffff' }}>Pro</option>
</Select>
<Select value={f.status} onChange={(e) => { setF({ ...f, status: e.target.value }); setPage(1); }} aria-label="Status">
  <option value="" style={{ backgroundColor: '#1c1c1e', color: '#ffffff' }}>Any status</option>
  <option value="active" style={{ backgroundColor: '#1c1c1e', color: '#ffffff' }}>Active</option>
  <option value="inactive" style={{ backgroundColor: '#1c1c1e', color: '#ffffff' }}>Deactivated</option>
</Select>
      </div>
      <div className={isFetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
        <DataTable loading={isLoading} onRow={(i) => nav(`/admin/users/${data.items[i].id}`)} head={['User', 'Plan', 'Credits', 'Status', 'Joined', 'Last active']}
          rows={(data?.items || []).map((u: any) => [<div key="u" className="flex items-center gap-3"><Avatar name={u.name} url={u.avatarUrl} size={34} /><div><p className="font-semibold text-fg">{u.name}{u.online && <span className="ml-2 inline-block h-2 w-2 rounded-full bg-ok" title="Online" />}</p><p className="text-xs text-fg-mute">{u.email}</p></div></div>, <Badge key="p" tone={u.plan === 'pro' ? 'pro' : 'neutral'}>{u.plan.toUpperCase()}</Badge>, formatNumber(u.credits), <Badge key="s" tone={u.isActive ? 'ok' : 'bad'}>{u.isActive ? 'Active' : 'Deactivated'}</Badge>, formatDate(u.createdAt).split(',')[0], timeAgo(u.lastActiveAt)])} empty="No users match." />
      </div>
      <Pagination page={page} pages={data?.pages || 1} onChange={setPage} />
    </div>
  );
}

export function AdminUserDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState('overview');
  const [creditOpen, setCreditOpen] = useState(false);
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [del, setDel] = useState(false);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin-user', id], queryFn: async () => (await api.get(`/admin/users/${id}`)).data });
  const inv = () => { qc.invalidateQueries({ queryKey: ['admin-user', id] }); qc.invalidateQueries({ queryKey: ['admin-users'] }); };
  const active = useMutation({ mutationFn: async (a: boolean) => api.post(`/admin/users/${id}/active`, { active: a }), onSuccess: () => { inv(); toast.success('User updated'); }, onError: (e) => toast.error('Failed', errorMessage(e)) });
  const plan = useMutation({ mutationFn: async (p: string) => api.post(`/admin/users/${id}/plan`, { plan: p }), onSuccess: () => { inv(); toast.success('Plan changed'); }, onError: (e) => toast.error('Failed', errorMessage(e)) });
  const credits = useMutation({ mutationFn: async () => api.post(`/admin/users/${id}/credits`, { delta: Number(delta), reason }), onSuccess: () => { inv(); setCreditOpen(false); setDelta(''); setReason(''); toast.success('Credits adjusted'); }, onError: (e) => toast.error('Failed', errorMessage(e)) });
  const remove = useMutation({ mutationFn: async () => api.delete(`/admin/users/${id}`), onSuccess: () => { toast.success('User deleted'); nav('/admin/users', { replace: true }); }, onError: (e) => toast.error('Failed', errorMessage(e)) });
  if (error) return <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />;
  if (isLoading || !data) return <Skeleton className="h-96" />;
  const u = data.user;
  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => nav('/admin/users')}><ArrowLeft className="h-4 w-4" />All users</Button>
      <div className="flex flex-wrap items-center gap-5"><Avatar name={u.name} url={u.avatarUrl} size={64} /><div className="min-w-0 flex-1"><h1 className="text-3xl font-extrabold tracking-tight">{u.name}</h1><p className="text-fg-mute">{u.email}{u.phone && ` · ${u.phone}`}</p><div className="mt-2 flex flex-wrap gap-2"><Badge tone={u.plan === 'pro' ? 'pro' : 'neutral'}>{u.plan.toUpperCase()}</Badge><Badge tone={u.isActive ? 'ok' : 'bad'}>{u.isActive ? 'Active' : 'Deactivated'}</Badge>{u.online && <Badge tone="ok">Online</Badge>}</div></div>
        <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => setCreditOpen(true)}><Coins className="h-4 w-4" />Adjust credits</Button>
          <Button variant="secondary" onClick={() => plan.mutate(u.plan === 'pro' ? 'free' : 'pro')} loading={plan.isPending}><Crown className="h-4 w-4" />{u.plan === 'pro' ? 'Move to Free' : 'Grant Pro'}</Button>
          <Button variant={u.isActive ? 'secondary' : 'primary'} onClick={() => active.mutate(!u.isActive)} loading={active.isPending}>{u.isActive ? <><UserX className="h-4 w-4" />Deactivate</> : <><UserCheck className="h-4 w-4" />Activate</>}</Button>
          <Button variant="danger" onClick={() => setDel(true)}><Trash2 className="h-4 w-4" />Delete</Button></div></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Stat label="Credits" value={formatNumber(u.credits)} sub={u.reservedCredits ? `${u.reservedCredits} reserved` : undefined} /><Stat label="Generations" value={data.usage.reduce((a: number, x: any) => a + x.count, 0)} /><Stat label="Artifacts" value={data.artifactCount} /><Stat label="Joined" value={formatDate(u.createdAt).split(',')[0]} sub={`Active ${timeAgo(u.lastActiveAt)}`} /></div>
      <Tabs tabs={[{ id: 'overview', label: 'Usage' }, { id: 'generations', label: 'Generations' }, { id: 'credits', label: 'Credit history' }, { id: 'billing', label: 'Billing' }, { id: 'reports', label: 'Reports', count: data.reports.length }, { id: 'collab', label: 'Collaboration' }]} value={tab} onChange={setTab} />
      {tab === 'overview' && <DataTable head={['Tool', 'Runs', 'Failed', 'Credits']} rows={data.usage.map((x: any) => [toolName(x.tool), x.count, x.failed || '—', x.credits])} empty="No usage yet." />}
      {tab === 'generations' && <DataTable head={['Tool', 'Title', 'Provider', 'Status', 'Credits', 'When']} rows={data.generations.map((g: any) => [toolName(g.tool), <span key="t" className="block max-w-[260px] truncate">{g.title}</span>, g.provider || '—', <Badge key="s" tone={g.status === 'completed' ? 'ok' : 'bad'}>{g.status}</Badge>, g.creditsUsed, timeAgo(g.createdAt)])} empty="No generations." />}
      {tab === 'credits' && <DataTable head={['When', 'Type', 'Change', 'Balance', 'Reason']} rows={data.transactions.map((t: any) => [formatDate(t.timestamp), t.type.replace('_', ' ').toLowerCase(), <b key="a" className={t.amount < 0 ? 'text-bad' : 'text-ok'}>{t.amount > 0 ? '+' : ''}{t.amount}</b>, t.balanceAfter, t.reason])} empty="No transactions." />}
      {tab === 'billing' && <div className="space-y-4"><DataTable head={['Subscription', 'Status', 'Period end']} rows={data.subscriptions.map((s: any) => [formatDate(s.createdAt), <Badge key="s" tone={s.status === 'active' ? 'ok' : 'neutral'}>{s.status}{s.cancelAtPeriodEnd && ' (cancelling)'}</Badge>, s.currentPeriodEnd ? formatDate(s.currentPeriodEnd) : '—'])} empty="No subscriptions." /><DataTable head={['Payment', 'Amount', 'Status']} rows={data.payments.map((p: any) => [formatDate(p.createdAt), `₹${p.amount}`, <Badge key="s" tone={p.status === 'paid' ? 'ok' : 'bad'}>{p.status}</Badge>])} empty="No payments." /></div>}
      {tab === 'reports' && <DataTable head={['Subject', 'Category', 'Status', 'Updated']} rows={data.reports.map((r: any) => [r.subject, r.category, <Badge key="s">{r.status}</Badge>, timeAgo(r.updatedAt)])} onRow={() => nav('/admin/support')} empty="No reports." />}
      {tab === 'collab' && <DataTable head={['Item', 'Owner', 'Collaborator', 'Permission']} rows={data.collaboration.map((c: any) => [c.artifact, c.owner, c.collaborator, c.permission])} empty="No collaboration." />}
      <Modal open={creditOpen} onClose={() => setCreditOpen(false)} title="Adjust credits" description="Positive adds credits, negative removes them. This is logged in the audit trail.">
        <form onSubmit={(e) => { e.preventDefault(); credits.mutate(); }} className="space-y-4"><Field label="Amount"><Input type="number" value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="e.g. 50 or -10" /></Field><Field label="Reason"><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Goodwill credit for outage" maxLength={200} /></Field>
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setCreditOpen(false)}>Cancel</Button><Button type="submit" loading={credits.isPending} disabled={!Number(delta) || reason.trim().length < 3}>Apply</Button></div></form></Modal>
      <ConfirmModal open={del} onClose={() => setDel(false)} onConfirm={() => remove.mutate()} loading={remove.isPending} danger title="Delete this user?" body={`${u.name} and all of their files, history and shared items will be permanently erased. Payment records are kept for accounting.`} confirmLabel="Delete user" />
    </div>
  );
}
