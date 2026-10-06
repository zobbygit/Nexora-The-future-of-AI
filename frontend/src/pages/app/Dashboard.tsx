import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowRight, Bell, Crown, FolderKanban, History, Sparkles, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/Button';
import { Badge, EmptyState, ErrorState, Skeleton } from '@/components/ui/primitives';
import { Tilt } from '@/components/ui/Tilt';
import { Card, SectionTitle } from '@/components/shared/Bits';
import { useBootstrap } from '@/hooks/useApp';
import { api } from '@/lib/api';
import { TOOL_BY_ID, toolName, toolPath } from '@/lib/tools';
import type { Artifact, Generation } from '@/lib/types';
import { cn, errorMessage, formatCountdown, formatNumber, timeAgo } from '@/lib/utils';
import { useAuth } from '@/store/auth';

interface Dash {
  credits: number; resetsAt?: string; plan: 'free' | 'pro'; today: { credits: number; generations: number }; totals: { generations: number; artifacts: number; shared: number };
  usage: { day: string; generations: number; credits: number }[]; recent: Generation[]; artifacts: Artifact[];
  collaboration: { id: string; permission: string; artifact: { id: string; title: string } | null; owner: string; collaborator: string; at: string; mine: boolean }[];
}

const greeting = () => { const h = new Date().getHours(); return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
const QUICK = ['writer', 'text-to-image', 'pdf', 'code'];

export default function Dashboard() {
  const user = useAuth((s) => s.user);
  const { data: boot } = useBootstrap();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['dashboard'], queryFn: async () => (await api.get<Dash>('/dashboard')).data, refetchInterval: 60_000 });
  const { data: notes } = useQuery({ queryKey: ['notifications', 'dash'], queryFn: async () => (await api.get('/notifications', { params: { unread: 'true' } })).data.items.slice(0, 3) as { id: string; title: string; body: string; createdAt: string; link?: string }[] });
  const pro = (data?.plan ?? user?.plan) === 'pro';
  const prefs = user?.onboarding?.useCases || [];
  const quick = [...QUICK].sort((a, b) => Number(prefs.some((p) => TOOL_BY_ID[b]?.category.toLowerCase().includes(p.toLowerCase()))) - Number(prefs.some((p) => TOOL_BY_ID[a]?.category.toLowerCase().includes(p.toLowerCase())))).slice(0, 4);
  if (error) return <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />;
  const cap = boot?.plans[pro ? 'pro' : 'free'].creditsPerPeriod || 1;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-[clamp(1.4rem,2.6vw,2rem)] font-semibold text-fg-soft">{greeting()},</p>
          <h1 className="text-[clamp(2.2rem,5vw,3.6rem)] font-extrabold leading-none tracking-[-0.04em]">{user?.name?.split(' ')[0]} <motion.span className="inline-block origin-[70%_70%]" animate={{ rotate: [0, 18, -8, 14, 0] }} transition={{ duration: 1.6, delay: 0.5 }}>👋</motion.span></h1>
          <p className="mt-2 text-fg-mute">Turn your ideas into reality with the power of AI.</p>
        </motion.div>
        <Tilt className="relative w-full overflow-hidden rounded-3xl border border-amber-400/25 bg-gradient-to-br from-amber-400/[0.12] to-violet-500/[0.06] p-5 sm:w-auto sm:min-w-[340px]" max={4}>
          <div className="flex items-center gap-4">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-400/15 text-amber-300"><Crown className="h-6 w-6" /></span>
            <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><p className="font-bold">{pro ? 'Pro Plan' : 'Free Plan'}</p><p className="text-sm font-bold text-amber-300">{formatNumber(data?.credits ?? boot?.credits ?? 0)} <span className="font-medium text-fg-mute">credits left</span></p></div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-violet-400" initial={{ width: 0 }} animate={{ width: `${Math.min(100, ((data?.credits ?? 0) / cap) * 100)}%` }} transition={{ duration: 1 }} /></div>
              <p className="mt-2 text-xs text-fg-mute">{pro ? 'Credits renew monthly' : `Daily reset in ${formatCountdown(data?.resetsAt || boot?.resetsAt)}`}</p></div>
          </div>
          <Button asChild size="sm" variant={pro ? 'secondary' : 'primary'} className="mt-4 w-full"><Link to="/app/billing">{pro ? 'Manage plan' : <><Sparkles className="h-3.5 w-3.5" />Upgrade to Pro</>}</Link></Button>
        </Tilt>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {quick.map((id, i) => { const t = TOOL_BY_ID[id]; const locked = boot?.tools.find((x) => x.id === id)?.locked; return (
          <motion.div key={id} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.07 }}>
            <Link to={toolPath(id)} className="block focus:outline-none"><Tilt className="surface group relative h-full p-4 sm:p-5" max={8}>
              <div className="flex items-start justify-between"><span className={cn('grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br shadow-lg', t.tile)}><t.icon className="h-5 w-5" /></span><span className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.06] text-fg-mute transition group-hover:bg-violet-500 group-hover:text-white"><ArrowRight className="h-4 w-4" /></span></div>
              <h3 className="mt-4 font-bold">{t.name}</h3><p className="mt-0.5 text-[13px] text-fg-mute">{t.short}</p>{locked && <Badge tone="pro" className="absolute right-16 top-5">Pro</Badge>}
            </Tilt></Link>
          </motion.div>); })}
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-2">
          <SectionTitle action={<Link to="/app/history" className="text-xs font-semibold text-violet-300 hover:text-violet-200">View All ›</Link>}>Recent Activity</SectionTitle>
          {isLoading ? <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div> : !data?.recent.length ? <EmptyState icon={<History className="h-6 w-6" />} title="Nothing yet" body="Run a tool and it will show up here." action={<Button asChild size="sm"><Link to="/app/tools">Explore tools</Link></Button>} /> :
            <ul className="space-y-1">{data.recent.map((g) => { const t = TOOL_BY_ID[g.tool]; return (
              <li key={g.id}><Link to={g.artifactId ? `/app/workspace?artifact=${g.artifactId}` : '/app/history'} className="flex items-center gap-3.5 rounded-2xl p-2.5 transition hover:bg-white/[0.05]">
                <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br', t?.tile || 'from-violet-500 to-indigo-500')}>{t && <t.icon className="h-[18px] w-[18px]" />}</span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-bold">{toolName(g.tool)}</span><span className="block truncate text-[13px] text-fg-mute">{g.title}</span></span><span className="shrink-0 text-xs text-fg-faint">{timeAgo(g.createdAt)}</span></Link></li>); })}</ul>}
        </Card>

        <Card className="xl:col-span-3">
          <SectionTitle action={<span className="text-xs font-semibold text-fg-mute">Last 7 days</span>}>Usage Overview</SectionTitle>
          {isLoading ? <Skeleton className="h-56" /> : (
            <div className="h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={data?.usage} margin={{ left: -18, right: 4, top: 6 }}><CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} /><XAxis dataKey="day" tick={{ fill: '#8b90a8', fontSize: 12 }} stroke="transparent" /><YAxis tick={{ fill: '#8b90a8', fontSize: 12 }} stroke="transparent" allowDecimals={false} />
              <RTooltip cursor={{ fill: 'rgba(255,255,255,.04)' }} contentStyle={{ background: '#131728', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, fontSize: 12 }} formatter={(v: unknown, n: unknown) => [String(v), n === 'generations' ? 'Generations' : 'Credits']} />
              <Bar dataKey="generations" fill="#8b5cf6" radius={[8, 8, 0, 0]} maxBarSize={38} /></BarChart></ResponsiveContainer></div>)}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[[formatNumber(data?.totals.generations), 'Total generations'], [formatNumber(data?.today.credits), 'Credits used today'], [formatNumber(data?.totals.artifacts), 'Files created'], [formatNumber(data?.totals.shared), 'Shared items']].map(([v, l]) => <div key={l} className="rounded-2xl border border-line bg-white/[0.03] px-4 py-3"><p className="text-2xl font-extrabold tracking-tight">{isLoading ? '–' : v}</p><p className="text-[11px] text-fg-mute">{l}</p></div>)}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card><SectionTitle action={<Link to="/app/workspace" className="text-xs font-semibold text-violet-300">Workspace ›</Link>}>Recent artifacts</SectionTitle>
          {!data?.artifacts.length ? <p className="py-6 text-center text-sm text-fg-mute">Your creations will appear here.</p> : <ul className="space-y-1">{data.artifacts.map((a) => <li key={a.id}><Link to={`/app/workspace?artifact=${a.id}`} className="flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-white/[0.05]"><span className="grid h-9 w-9 place-items-center rounded-lg bg-white/[0.06] text-violet-300"><FolderKanban className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{a.title}</span><span className="text-xs capitalize text-fg-mute">{a.kind} · {timeAgo(a.createdAt)}</span></span></Link></li>)}</ul>}</Card>
        <Card><SectionTitle action={<Link to="/app/collaboration" className="text-xs font-semibold text-violet-300">Open ›</Link>}>Collaboration</SectionTitle>
          {!data?.collaboration.length ? <p className="py-6 text-center text-sm text-fg-mute">Share an artifact to start collaborating.</p> : <ul className="space-y-1">{data.collaboration.map((c) => <li key={c.id} className="flex items-center gap-3 rounded-xl p-2.5"><span className="grid h-9 w-9 place-items-center rounded-lg bg-sky2/15 text-sky2"><Users className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{c.artifact?.title}</span><span className="text-xs text-fg-mute">{c.mine ? `Shared with ${c.collaborator}` : `From ${c.owner}`} · {c.permission}</span></span></li>)}</ul>}</Card>
        <Card><SectionTitle action={<Link to="/app/notifications" className="text-xs font-semibold text-violet-300">All ›</Link>}>Notifications</SectionTitle>
          {!notes?.length ? <p className="py-6 text-center text-sm text-fg-mute">You are all caught up.</p> : <ul className="space-y-1">{notes.map((n) => <li key={n.id}><Link to={n.link || '/app/notifications'} className="flex items-start gap-3 rounded-xl p-2.5 transition hover:bg-white/[0.05]"><span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-violet-500/15 text-violet-300"><Bell className="h-4 w-4" /></span><span className="min-w-0"><span className="block truncate text-sm font-semibold">{n.title}</span><span className="line-clamp-1 text-xs text-fg-mute">{n.body}</span></span></Link></li>)}</ul>}</Card>
      </div>

      {!pro && <Tilt max={3} className="relative overflow-hidden rounded-3xl border border-violet-400/30 bg-gradient-to-r from-violet-600/25 via-violet-500/10 to-sky2/15 p-7 sm:p-9"><div className="relative flex flex-wrap items-center justify-between gap-5"><div><h2 className="text-2xl font-extrabold tracking-tight">Unlock all 13 tools with Pro</h2><p className="mt-1.5 max-w-xl text-fg-soft">Audio, vision, data analysis and video — plus 3,000 credits every month for ₹400.</p></div><Button asChild size="lg" variant="light"><Link to="/app/billing">Upgrade to Pro <ArrowRight className="h-4 w-4" /></Link></Button></div></Tilt>}
    </div>
  );
}
