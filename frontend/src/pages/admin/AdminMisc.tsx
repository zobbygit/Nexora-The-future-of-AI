import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Megaphone, Pencil, Send, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/Button';
import { Badge, ConfirmModal, EmptyState, ErrorState, Field, Input, Modal, Pagination, Select, Skeleton, Switch, Tabs, Textarea } from '@/components/ui/primitives';
import { Card, PageHeader, SectionTitle } from '@/components/shared/Bits';
import { api } from '@/lib/api';
import { toolName } from '@/lib/tools';
import { downloadBlob, errorMessage, formatDate, timeAgo } from '@/lib/utils';
import { toast } from '@/store/ui';
import { DataTable, Stat, axis, chartTip, shortDate } from './adminKit';
import { ProviderCards } from './AdminAI';

const COLORS = ['#8b5cf6', '#4f8bff', '#22d3ee', '#34d399', '#fbbf24', '#f472b6'];

export function AdminComm() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('announcements');
  const [edit, setEdit] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [del, setDel] = useState<any>(null);
  const [f, setF] = useState({ title: '', message: '', audience: 'all', scheduledFor: '' });
  const [picked, setPicked] = useState<{ id: string; name: string; email: string }[]>([]);
  const [uq, setUq] = useState('');
  const found = useQuery({ queryKey: ['ann-users', uq], enabled: uq.trim().length >= 2, queryFn: async () => (await api.get('/admin/support/users', { params: { q: uq } })).data.users as { id: string; name: string; email: string }[] });
  const [sys, setSys] = useState({ q: '', userId: '', userName: '', title: '', body: '' });
  const sysFound = useQuery({ queryKey: ['sys-users', sys.q], enabled: sys.q.trim().length >= 2 && !sys.userId, queryFn: async () => (await api.get('/admin/support/users', { params: { q: sys.q } })).data.users as { id: string; name: string; email: string }[] });
  const sendSys = useMutation({ mutationFn: async () => api.post('/admin/communication/notifications', { userId: sys.userId, title: sys.title, body: sys.body }), onSuccess: () => { toast.success('Notification sent'); setSys({ q: '', userId: '', userName: '', title: '', body: '' }); qc.invalidateQueries({ queryKey: ['admin-notif-stats'] }); }, onError: (e) => toast.error('Failed', errorMessage(e)) });
  const ann = useQuery({ queryKey: ['admin-ann'], queryFn: async () => (await api.get('/admin/communication/announcements')).data.items as any[] });
  const stats = useQuery({ queryKey: ['admin-notif-stats'], enabled: tab === 'notifications', queryFn: async () => (await api.get('/admin/communication/notifications')).data.groups as any[] });
  const reset = () => { setF({ title: '', message: '', audience: 'all', scheduledFor: '' }); setPicked([]); setUq(''); setEdit(null); setOpen(false); };
  const save = useMutation({
    mutationFn: async () => { const body = { title: f.title, message: f.message, audience: f.audience, userIds: f.audience === 'selected' ? picked.map((p) => p.id) : undefined, scheduledFor: f.scheduledFor ? new Date(f.scheduledFor).toISOString() : undefined }; return edit ? api.patch(`/admin/communication/announcements/${edit.id}`, body) : api.post('/admin/communication/announcements', body); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-ann'] }); toast.success(edit ? 'Announcement updated' : f.scheduledFor ? 'Announcement scheduled' : 'Announcement sent'); reset(); }, onError: (e) => toast.error('Failed', errorMessage(e)),
  });
  const remove = useMutation({ mutationFn: async (id: string) => api.delete(`/admin/communication/announcements/${id}`), onSuccess: () => { setDel(null); qc.invalidateQueries({ queryKey: ['admin-ann'] }); toast.success('Deleted'); }, onError: (e) => toast.error('Failed', errorMessage(e)) });
  const startEdit = (a: any) => { setEdit(a); setF({ title: a.title, message: a.message, audience: a.audience, scheduledFor: '' }); setOpen(true); };
  return (
    <div className="space-y-6">
      <PageHeader title="Communication" eyebrow="Admin" subtitle="Announcements and notification activity." actions={<Button onClick={() => { reset(); setOpen(true); }}><Megaphone className="h-4 w-4" />New announcement</Button>} />
      <Tabs tabs={[{ id: 'announcements', label: 'Announcements' }, { id: 'notifications', label: 'Notification activity' }]} value={tab} onChange={setTab} />
      {tab === 'announcements' && (ann.error ? <ErrorState message={errorMessage(ann.error)} onRetry={() => ann.refetch()} /> : ann.isLoading ? <Skeleton className="h-52" /> : !ann.data?.length ? <EmptyState icon={<Megaphone className="h-6 w-6" />} title="No announcements yet" body="Send an update to every user, a plan, or schedule it for later." action={<Button onClick={() => setOpen(true)}>Create announcement</Button>} /> : (
        <div className="space-y-2.5">{ann.data.map((a) => <div key={a.id} className="surface flex flex-wrap items-center gap-4 p-4"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-bold">{a.title}</p><Badge tone={a.status === 'sent' ? 'ok' : 'warn'}>{a.status === 'sent' ? `Sent · ${a.recipientCount}` : `Scheduled ${formatDate(a.scheduledFor)}`}</Badge><Badge>{a.audience}</Badge></div><p className="mt-1 line-clamp-2 text-sm text-fg-mute">{a.message}</p><p className="mt-1 text-xs text-fg-faint">{timeAgo(a.createdAt)}</p></div>
          <Button size="icon" variant="ghost" onClick={() => startEdit(a)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" className="hover:!text-bad" onClick={() => setDel(a)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button></div>)}</div>))}
      {tab === 'notifications' && <Card><SectionTitle>Send a system notification</SectionTitle><form onSubmit={(e) => { e.preventDefault(); sendSys.mutate(); }} className="grid gap-3 md:grid-cols-2">
        <div className="relative md:col-span-2"><Input value={sys.userId ? sys.userName : sys.q} onChange={(e) => setSys({ ...sys, q: e.target.value, userId: '', userName: '' })} placeholder="Recipient — search by name or email" aria-label="Recipient" />
          {!sys.userId && !!sysFound.data?.length && <div className="glass-strong absolute inset-x-0 top-12 z-10 rounded-2xl p-1.5">{sysFound.data.map((u) => <button type="button" key={u.id} onClick={() => setSys({ ...sys, userId: u.id, userName: `${u.name} · ${u.email}` })} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-white/[0.07]"><span>{u.name}</span><span className="text-xs text-fg-mute">{u.email}</span></button>)}</div>}</div>
        <Input value={sys.title} onChange={(e) => setSys({ ...sys, title: e.target.value })} placeholder="Title" maxLength={120} aria-label="Notification title" /><Input value={sys.body} onChange={(e) => setSys({ ...sys, body: e.target.value })} placeholder="Message (optional)" maxLength={500} aria-label="Notification message" />
        <div className="md:col-span-2"><Button type="submit" loading={sendSys.isPending} disabled={!sys.userId || sys.title.trim().length < 3}><Send className="h-4 w-4" />Send notification</Button></div></form></Card>}
      {tab === 'notifications' && <DataTable loading={stats.isLoading} head={['Type', 'Last 30 days', 'Unread']} rows={(stats.data || []).map((g) => [g.type.replace('_', ' '), g.total, g.unread])} empty="No notifications yet." />}
      <Modal open={open} onClose={reset} title={edit ? 'Edit announcement' : 'New announcement'} description={edit?.status === 'sent' ? 'Already delivered: title and message update in users’ notifications.' : 'Delivered as an in-app notification.'}>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
          <Field label="Title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={120} /></Field>
          <Field label="Message"><Textarea className="min-h-[110px]" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} maxLength={1000} /></Field>
          {(!edit || edit.status !== 'sent') && <div className="grid gap-4 sm:grid-cols-2">
     <Field label="Audience">
  <Select value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })}>
    <option value="all" style={{ backgroundColor: '#1c1c1e', color: '#ffffff' }}>Everyone</option>
    <option value="free" style={{ backgroundColor: '#1c1c1e', color: '#ffffff' }}>Free users</option>
    <option value="pro" style={{ backgroundColor: '#1c1c1e', color: '#ffffff' }}>Pro users</option>
    <option value="selected" style={{ backgroundColor: '#1c1c1e', color: '#ffffff' }}>Selected users</option>
  </Select>
</Field>
            
            <Field label="Schedule (optional)" hint="Leave empty to send now."><Input type="datetime-local" value={f.scheduledFor} onChange={(e) => setF({ ...f, scheduledFor: e.target.value })} /></Field></div>}
          {f.audience === 'selected' && (!edit || edit.status !== 'sent') && <div className="space-y-2"><Input value={uq} onChange={(e) => setUq(e.target.value)} placeholder="Search users to add…" aria-label="Find users" />
            {!!found.data?.length && <div className="rounded-xl border border-line bg-white/[0.03] p-1">{found.data.filter((u) => !picked.some((p) => p.id === u.id)).map((u) => <button type="button" key={u.id} onClick={() => { setPicked([...picked, u]); setUq(''); }} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-white/[0.06]"><span>{u.name}</span><span className="text-xs text-fg-mute">{u.email}</span></button>)}</div>}
            <div className="flex flex-wrap gap-1.5">{picked.map((u) => <button type="button" key={u.id} onClick={() => setPicked(picked.filter((p) => p.id !== u.id))} className="rounded-full border border-violet-400/40 bg-violet-500/15 px-2.5 py-1 text-xs font-semibold" aria-label={`Remove ${u.name}`}>{u.name} ✕</button>)}{!picked.length && <span className="text-xs text-fg-mute">No recipients chosen yet.</span>}</div></div>}
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={reset}>Cancel</Button><Button type="submit" loading={save.isPending} disabled={f.title.trim().length < 3 || f.message.trim().length < 3 || (f.audience === 'selected' && !picked.length && !edit)}><Send className="h-4 w-4" />{edit ? 'Save' : f.scheduledFor ? 'Schedule' : 'Send now'}</Button></div>
        </form>
      </Modal>
      <ConfirmModal open={!!del} onClose={() => setDel(null)} onConfirm={() => del && remove.mutate(del.id)} loading={remove.isPending} danger title="Delete announcement?" body="It will also be removed from users’ notification lists." confirmLabel="Delete" />
    </div>
  );
}

export function AdminAnalytics() {
  const [days, setDays] = useState('30');
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin-analytics', days], queryFn: async () => (await api.get('/admin/analytics', { params: { days } })).data });
  const pdf = useMutation({ mutationFn: async () => (await api.get('/admin/analytics/export/pdf', { params: { days }, responseType: 'blob' })).data as Blob, onSuccess: (b) => downloadBlob(b, 'nexora-analytics.pdf'), onError: () => toast.error('Export failed') });
  if (error) return <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />;
  const Chart = ({ title, children, h = 240 }: { title: string; children: React.ReactNode; h?: number }) => <Card><SectionTitle>{title}</SectionTitle><div style={{ height: h }}>{isLoading ? <Skeleton className="h-full" /> : <ResponsiveContainer width="100%" height="100%">{children as any}</ResponsiveContainer>}</div></Card>;
  const d = data;
  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" eyebrow="Admin" subtitle="Users, AI usage and revenue." actions={<><Select value={days} onChange={(e) => setDays(e.target.value)} className="!w-auto" aria-label="Range">
       <option value="7" style={{ backgroundColor: '#1c1c1e', color: '#ffffff' }}>Last 7 days</option>
<option value="30" style={{ backgroundColor: '#1c1c1e', color: '#ffffff' }}>Last 30 days</option>
<option value="90" style={{ backgroundColor: '#1c1c1e', color: '#ffffff' }}>Last 90 days</option>
        
        </Select><Button variant="secondary" onClick={() => pdf.mutate()} loading={pdf.isPending}><Download className="h-4 w-4" />Export PDF</Button></>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Stat label="New registrations" value={d?.users.registrations ?? '–'} /><Stat label="Generations" value={d?.ai.totalGenerations ?? '–'} /><Stat label="Success rate" value={d?.ai.successRate != null ? `${d.ai.successRate}%` : '—'} tone={d?.ai.successRate != null && d.ai.successRate < 90 ? 'warn' : 'ok'} /><Stat label="Fallback rate" value={d?.ai.fallbackRate != null ? `${d.ai.fallbackRate}%` : '—'} /></div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Chart title="User growth"><AreaChart data={d?.users.growth} margin={{ left: -18 }}><CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} /><XAxis dataKey="date" tickFormatter={shortDate} {...axis} interval="preserveStartEnd" /><YAxis allowDecimals={false} {...axis} /><RTooltip {...chartTip} labelFormatter={(l: unknown) => shortDate(String(l))} /><Area dataKey="registrations" name="Registrations" stroke="#8b5cf6" fill="#8b5cf633" strokeWidth={2} /></AreaChart></Chart>
        <Chart title="Daily active users"><AreaChart data={d?.users.active} margin={{ left: -18 }}><CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} /><XAxis dataKey="date" tickFormatter={shortDate} {...axis} interval="preserveStartEnd" /><YAxis allowDecimals={false} {...axis} /><RTooltip {...chartTip} labelFormatter={(l: unknown) => shortDate(String(l))} /><Area dataKey="active" name="Active" stroke="#22d3ee" fill="#22d3ee22" strokeWidth={2} /></AreaChart></Chart>
        <Chart title="Generations & failures"><AreaChart data={d?.ai.daily} margin={{ left: -18 }}><CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} /><XAxis dataKey="date" tickFormatter={shortDate} {...axis} interval="preserveStartEnd" /><YAxis allowDecimals={false} {...axis} /><RTooltip {...chartTip} labelFormatter={(l: unknown) => shortDate(String(l))} /><Area dataKey="total" name="Total" stroke="#8b5cf6" fill="#8b5cf622" strokeWidth={2} /><Area dataKey="failed" name="Failed" stroke="#f87171" fill="transparent" strokeWidth={2} /><Area dataKey="fallback" name="Fallback" stroke="#fbbf24" fill="transparent" strokeWidth={2} /></AreaChart></Chart>
        <Chart title="Credits consumed"><BarChart data={d?.ai.credits} margin={{ left: -18 }}><CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} /><XAxis dataKey="date" tickFormatter={shortDate} {...axis} interval="preserveStartEnd" /><YAxis allowDecimals={false} {...axis} /><RTooltip {...chartTip} labelFormatter={(l: unknown) => shortDate(String(l))} /><Bar dataKey="credits" fill="#4f8bff" radius={[6, 6, 0, 0]} /></BarChart></Chart>
        <Chart title="Tool popularity"><BarChart layout="vertical" data={(d?.ai.tools || []).map((t: any) => ({ ...t, name: toolName(t.tool) }))} margin={{ left: 40 }}><CartesianGrid stroke="rgba(255,255,255,.06)" horizontal={false} /><XAxis type="number" allowDecimals={false} {...axis} /><YAxis type="category" dataKey="name" width={130} {...axis} /><RTooltip {...chartTip} /><Bar dataKey="count" name="Runs" radius={[0, 6, 6, 0]}>{(d?.ai.tools || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Bar></BarChart></Chart>
        <Chart title="Provider usage"><PieChart><Pie data={(d?.ai.providers || []).map((p: any) => ({ name: p.provider, value: p.count }))} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3} stroke="none">{(d?.ai.providers || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><RTooltip {...chartTip} /></PieChart></Chart>
        <Chart title="Free vs Pro"><PieChart><Pie data={(d?.users.plan || []).map((p: any) => ({ name: p.plan, value: p.count }))} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3} stroke="none">{(d?.users.plan || []).map((_: any, i: number) => <Cell key={i} fill={i ? '#fbbf24' : '#8b5cf6'} />)}</Pie><RTooltip {...chartTip} /></PieChart></Chart>
        <Chart title="Revenue (₹)"><BarChart data={d?.revenue.daily} margin={{ left: -10 }}><CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} /><XAxis dataKey="date" tickFormatter={shortDate} {...axis} interval="preserveStartEnd" /><YAxis {...axis} /><RTooltip {...chartTip} labelFormatter={(l: unknown) => shortDate(String(l))} /><Bar dataKey="revenue" fill="#34d399" radius={[6, 6, 0, 0]} /></BarChart></Chart>
        <Chart title="Subscription growth"><AreaChart data={d?.revenue.subscriptionGrowth} margin={{ left: -18 }}><CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} /><XAxis dataKey="date" tickFormatter={shortDate} {...axis} interval="preserveStartEnd" /><YAxis allowDecimals={false} {...axis} /><RTooltip {...chartTip} labelFormatter={(l: unknown) => shortDate(String(l))} /><Area dataKey="subscriptions" name="New subscriptions" stroke="#fbbf24" fill="#fbbf2422" strokeWidth={2} /></AreaChart></Chart>
      </div>
      <div className="grid gap-4 sm:grid-cols-3"><Stat label="Pro conversions" value={d?.revenue.conversions ?? '–'} sub={d ? `${d.revenue.conversionRate}% of users` : ''} /><Stat label="Revenue in range" value={d ? `₹${d.revenue.total}` : '–'} /><Stat label="Payment outcomes" value={d ? d.revenue.paymentStatus.map((p: any) => `${p.count} ${p.status}`).join(' · ') || '—' : '–'} /></div>
    </div>
  );
}

export function AdminSystem() {
  const qc = useQueryClient();
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') || 'status';
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const sys = useQuery({ queryKey: ['admin-system'], queryFn: async () => (await api.get('/admin/system')).data, refetchInterval: 30_000 });
  const audit = useQuery({ queryKey: ['admin-audit', q, page], enabled: tab === 'audit', queryFn: async () => (await api.get('/admin/system/audit', { params: { q: q || undefined, page, limit: 25 } })).data, placeholderData: (p) => p });
  const toggle = useMutation({ mutationFn: async (b: Record<string, boolean>) => api.put('/admin/system/settings', b), onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-system'] }); toast.success('Setting saved'); }, onError: (e) => toast.error('Failed', errorMessage(e)) });
  const exp = useMutation({ mutationFn: async (fmt: 'pdf' | 'json') => ({ fmt, b: (await api.get(`/admin/system/audit/export/${fmt}`, { responseType: 'blob' })).data as Blob }), onSuccess: ({ fmt, b }) => downloadBlob(b, `nexora-audit.${fmt}`), onError: () => toast.error('Export failed') });
  if (sys.error) return <ErrorState message={errorMessage(sys.error)} onRetry={() => sys.refetch()} />;
  const d = sys.data;
  const S = d?.settings;
  const up = d ? `${Math.floor(d.uptimeSeconds / 3600)}h ${Math.floor((d.uptimeSeconds % 3600) / 60)}m` : '–';
  return (
    <div className="space-y-6">
      <PageHeader title="System" eyebrow="Admin" subtitle="Health, errors, activity, settings and the audit trail." />
      <Tabs tabs={[{ id: 'status', label: 'Status' }, { id: 'errors', label: 'API errors' }, { id: 'activity', label: 'Activity' }, { id: 'settings', label: 'Settings' }, { id: 'audit', label: 'Audit logs' }]} value={tab} onChange={(v) => setSp({ tab: v }, { replace: true })} />
      {tab === 'status' && <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Stat label="Uptime" value={up} /><Stat label="Environment" value={d?.env ?? '–'} sub={d?.node} /><Stat label="AI mode" value={d?.mock ? 'Simulated' : 'Live'} tone={d?.mock ? 'warn' : 'ok'} /><Stat label="Stripe" value={d?.stripe.enabled ? d.stripe.mode : 'Off'} tone={d?.stripe.enabled ? 'ok' : 'warn'} /></div><ProviderCards providers={d?.providers} loading={sys.isLoading} /></>}
      {tab === 'errors' && <DataTable loading={sys.isLoading} head={['When', 'Status', 'Code', 'Route', 'Message']} rows={(d?.errors || []).map((e: any) => [timeAgo(e.timestamp), <Badge key="s" tone="bad">{e.status}</Badge>, e.code, <span key="r" className="font-mono text-xs">{e.method} {e.path}</span>, <span key="m" className="block max-w-[320px] truncate">{e.message}</span>])} empty="No server errors recorded. 🎉" />}
      {tab === 'activity' && <Card>{sys.isLoading ? <Skeleton className="h-52" /> : <ol className="space-y-3">{d.activity.map((a: any, i: number) => <li key={i} className="flex items-center gap-3 text-sm"><span className="h-2 w-2 shrink-0 rounded-full bg-violet-400" /><span className="flex-1 text-fg-soft">{a.text}</span><span className="text-xs text-fg-faint">{timeAgo(a.at)}</span></li>)}</ol>}</Card>}
      {tab === 'settings' && <Card className="max-w-2xl divide-y divide-line !py-2">{([['registrationEnabled', 'Allow new registrations', 'Turn off to close sign-ups.'], ['supportChatEnabled', 'Live support chat', 'Disable if nobody is available to reply.'], ['maintenanceMode', 'Maintenance mode', 'Users see a maintenance message. Admins keep access.']] as const).map(([k, l, h]) => <div key={k} className="flex items-center justify-between gap-6 py-4"><div><p className="font-bold">{l}</p><p className="text-sm text-fg-mute">{h}</p></div><Switch checked={!!S?.[k]} onChange={(v) => toggle.mutate({ [k]: v })} label={l} /></div>)}</Card>}
      {tab === 'audit' && <><div className="flex flex-wrap items-center gap-3"><Input className="max-w-xs" placeholder="Filter by action or target…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Filter audit logs" /><div className="ml-auto flex gap-2"><Button variant="secondary" onClick={() => exp.mutate('pdf')} loading={exp.isPending && exp.variables === 'pdf'}><Download className="h-4 w-4" />PDF</Button><Button variant="secondary" onClick={() => exp.mutate('json')} loading={exp.isPending && exp.variables === 'json'}><Download className="h-4 w-4" />JSON</Button></div></div>
        <DataTable loading={audit.isLoading} head={['When', 'Admin', 'Action', 'Target', 'Details']} rows={(audit.data?.items || []).map((l: any) => [formatDate(l.timestamp), l.admin, <Badge key="a">{l.action}</Badge>, <span key="t" className="font-mono text-xs">{l.target || '—'}</span>, <span key="m" className="block max-w-[280px] truncate font-mono text-xs text-fg-mute">{l.metadata ? JSON.stringify(l.metadata) : ''}</span>])} empty="No audit entries yet." /><Pagination page={page} pages={audit.data?.pages || 1} onChange={setPage} /></>}
    </div>
  );
}
