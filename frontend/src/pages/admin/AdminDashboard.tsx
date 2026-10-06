import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, Coins, CreditCard, LifeBuoy, Sparkles, Users, Zap } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import { Link } from 'react-router-dom';
import { Badge, ErrorState } from '@/components/ui/primitives';
import { Card, PageHeader, SectionTitle } from '@/components/shared/Bits';
import { api } from '@/lib/api';
import { toolName } from '@/lib/tools';
import { errorMessage, formatInr, formatNumber, timeAgo } from '@/lib/utils';
import { DataTable, Stat, axis, chartTip, shortDate } from './adminKit';
import { ProviderCards } from './AdminAI';

export default function AdminDashboard() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin-dash'], queryFn: async () => (await api.get('/admin/dashboard')).data, refetchInterval: 30_000 });
  if (error) return <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />;
  const m = data?.metrics;
  const v = (n?: number) => (isLoading ? '–' : formatNumber(n));
  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" eyebrow="Admin" subtitle="Platform health at a glance. Updates live." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total users" value={v(m?.totalUsers)} sub={`${m?.freeUsers ?? 0} free · ${m?.proUsers ?? 0} pro`} icon={<Users />} />
        <Stat label="Generations today" value={v(m?.todayGenerations)} icon={<Sparkles />} />
        <Stat label="Credits consumed today" value={v(m?.creditsConsumed)} icon={<Coins />} />
        <Stat label="Revenue" value={isLoading ? '–' : formatInr(m?.revenue)} sub={`${m?.activeSubscriptions ?? 0} active subscriptions`} icon={<CreditCard />} />
        <Stat label="Active providers" value={isLoading ? '–' : `${m?.activeProviders}/${m?.totalProviders}`} tone={m && m.activeProviders < m.totalProviders ? 'warn' : 'ok'} icon={<Zap />} />
        <Stat label="Failed requests (24h)" value={v(m?.failedRequests)} tone={m?.failedRequests ? 'bad' : undefined} icon={<AlertTriangle />} />
        <Stat label="Open reports" value={v(m?.openReports)} tone={m?.openReports ? 'warn' : undefined} icon={<LifeBuoy />} />
        <Stat label="Pro users" value={v(m?.proUsers)} icon={<Activity />} />
      </div>
      <Card><SectionTitle>Generations · last 14 days</SectionTitle>
        <div className="h-64"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data?.genDaily || []} margin={{ left: -18, right: 6, top: 6 }}><defs><linearGradient id="gA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8b5cf6" stopOpacity={0.5} /><stop offset="1" stopColor="#8b5cf6" stopOpacity={0} /></linearGradient></defs>
          <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} /><XAxis dataKey="date" tickFormatter={shortDate} {...axis} /><YAxis allowDecimals={false} {...axis} /><RTooltip {...chartTip} labelFormatter={(l: unknown) => shortDate(String(l))} />
          <Area dataKey="total" name="Total" stroke="#8b5cf6" strokeWidth={2} fill="url(#gA)" /><Area dataKey="failed" name="Failed" stroke="#f87171" strokeWidth={2} fill="transparent" /></AreaChart></ResponsiveContainer></div></Card>
      <div><SectionTitle>Provider health</SectionTitle><ProviderCards providers={data?.providers} loading={isLoading} /></div>
      <div><SectionTitle action={<Link to="/admin/ai" className="text-xs font-semibold text-violet-300">All generations ›</Link>}>Recent generations</SectionTitle>
        <DataTable loading={isLoading} head={['Tool', 'User', 'Provider', 'Status', 'Credits', 'When']} rows={(data?.recent || []).map((g: any) => [toolName(g.tool), g.user, <span key="p" className="capitalize">{g.provider || '—'}{g.fallbackUsed ? ' ↩' : ''}</span>, <Badge key="s" tone={g.status === 'completed' ? 'ok' : 'bad'}>{g.status}</Badge>, g.creditsUsed, timeAgo(g.createdAt)])} /></div>
    </div>
  );
}
