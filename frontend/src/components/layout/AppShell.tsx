import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, CreditCard, FolderKanban, History, LayoutDashboard, LifeBuoy, LogOut, Menu, Search, Settings2, Sparkles, UserRound, Users, Wand2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Skeleton, TooltipProvider } from '@/components/ui/primitives';
import { useBootstrap, useRealtime } from '@/hooks/useApp';
import { api } from '@/lib/api';
import { CATEGORIES, TOOL_META, toolPath } from '@/lib/tools';
import type { NotificationItem } from '@/lib/types';
import { cn, formatCountdown, formatNumber, timeAgo } from '@/lib/utils';
import { useAuth } from '@/store/auth';
import { useUi } from '@/store/ui';
import { Sidebar, type NavItem } from './Sidebar';

export const Avatar = ({ name, url, size = 36 }: { name?: string; url?: string; size?: number }) => (
  url ? <img src={url.startsWith('http') ? url : url} alt={name || 'Avatar'} style={{ width: size, height: size }} className="rounded-full object-cover" />
    : <span style={{ width: size, height: size, fontSize: size * 0.4 }} className="grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-sky2 font-bold">{(name || '?')[0]?.toUpperCase()}</span>
);

const useNav = (unread: number, chat: number): NavItem[] => useMemo(() => [
  { to: '/app', label: 'Dashboard', icon: <LayoutDashboard />, end: true },
  { to: '/app/tools', label: 'AI Tools', icon: <Wand2 />, children: CATEGORIES.map((g) => ({ group: g, items: TOOL_META.filter((t) => t.category === g).map((t) => ({ to: toolPath(t.id), label: t.name, icon: <t.icon />, pro: !t.free })) })) },
  { to: '/app/workspace', label: 'Workspace', icon: <FolderKanban /> },
  { to: '/app/collaboration', label: 'Collaboration', icon: <Users /> },
  { to: '/app/history', label: 'History', icon: <History /> },
  { to: '/app/billing', label: 'Billing', icon: <CreditCard /> },
  { to: '/app/support', label: 'Support', icon: <LifeBuoy />, badge: chat },
  { to: '/app/notifications', label: 'Notifications', icon: <Bell />, badge: unread },
], [unread, chat]);

const CreditsCard = () => {
  const { data } = useBootstrap();
  if (!data) return <Skeleton className="h-24" />;
  const pro = data.user.plan === 'pro';
  const cap = data.plans[data.user.plan].creditsPerPeriod;
  return (
    <div className="rounded-2xl border border-line bg-white/[0.03] p-3.5">
      <div className="flex items-center justify-between"><span className={cn('text-xs font-bold', pro ? 'text-amber-300' : 'text-fg-soft')}>{pro ? 'Pro plan' : 'Free plan'}</span><span className="text-[11px] text-fg-mute">{pro ? 'renews monthly' : `resets in ${formatCountdown(data.resetsAt)}`}</span></div>
      <p className="mt-1.5 text-xl font-extrabold">{formatNumber(data.credits)} <span className="text-xs font-semibold text-fg-mute">credits</span></p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-sky2" animate={{ width: `${Math.min(100, (data.credits / cap) * 100)}%` }} /></div>
      {!pro && <Button asChild size="sm" className="mt-3 w-full"><Link to="/app/billing"><Sparkles className="h-3.5 w-3.5" />Upgrade to Pro</Link></Button>}
    </div>
  );
};

const SearchBox = () => {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const { data } = useQuery({ queryKey: ['search', q], enabled: q.trim().length >= 2, queryFn: async () => (await api.get('/search', { params: { q } })).data, staleTime: 15_000 });
  const tools = q.trim().length >= 1 ? TOOL_META.filter((t) => t.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 4) : [];
  useEffect(() => {
    const click = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); (ref.current?.querySelector('input') as HTMLInputElement)?.focus(); setOpen(true); } if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', click); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', click); document.removeEventListener('keydown', key); };
  }, []);
  const go = (to: string) => { setOpen(false); setQ(''); nav(to); };
  const has = tools.length || data?.artifacts?.length || data?.generations?.length || data?.shared?.length;
  return (
    <div ref={ref} className="relative min-w-0 flex-1 md:max-w-xl">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-mute" />
      <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder="Search tools, files, or anything…" aria-label="Search"
        className="h-11 w-full rounded-full border border-white/[0.08] bg-white/[0.04] pl-11 pr-14 text-sm outline-none transition placeholder:text-fg-faint focus:border-violet-500/60 focus:ring-4 focus:ring-violet-500/15" />
      <kbd className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 rounded-md border border-white/10 px-1.5 py-0.5 font-mono text-[10px] text-fg-faint sm:block">⌘K</kbd>
      <AnimatePresence>
        {open && q.trim().length >= 1 && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="glass-strong absolute left-0 right-0 top-14 z-50 max-h-[60vh] overflow-y-auto rounded-2xl p-2">
            {!has && <p className="px-3 py-6 text-center text-sm text-fg-mute">No results for “{q}”.</p>}
            {tools.length > 0 && <Group label="Tools">{tools.map((t) => <Row key={t.id} onClick={() => go(toolPath(t.id))} icon={<t.icon className="h-4 w-4" />} title={t.name} sub={t.category} />)}</Group>}
            {!!data?.artifacts?.length && <Group label="Workspace">{data.artifacts.map((a: any) => <Row key={a.id} onClick={() => go(`/app/workspace?artifact=${a.id}`)} icon={<FolderKanban className="h-4 w-4" />} title={a.title} sub={a.kind} />)}</Group>}
            {!!data?.shared?.length && <Group label="Shared with you">{data.shared.map((a: any) => <Row key={a.id} onClick={() => go(`/app/workspace?artifact=${a.id}&scope=shared`)} icon={<Users className="h-4 w-4" />} title={a.title} sub={a.kind} />)}</Group>}
            {!!data?.generations?.length && <Group label="History">{data.generations.map((g: any) => <Row key={g.id} onClick={() => go('/app/history')} icon={<History className="h-4 w-4" />} title={g.title} sub={g.tool} />)}</Group>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
const Group = ({ label, children }: { label: string; children: React.ReactNode }) => <div className="mb-1"><p className="label px-3 py-2">{label}</p>{children}</div>;
const Row = ({ icon, title, sub, onClick }: { icon: React.ReactNode; title: string; sub?: string; onClick: () => void }) => (
  <button onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/[0.07]"><span className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.06] text-violet-300">{icon}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{title}</span>{sub && <span className="block text-xs capitalize text-fg-mute">{sub}</span>}</span></button>
);

const Bell_ = () => {
  const qc = useQueryClient();
  const { data: boot } = useBootstrap();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const nav = useNavigate();
  const { data } = useQuery({ queryKey: ['notifications', 'bell'], enabled: open, queryFn: async () => (await api.get('/notifications')).data as { items: NotificationItem[] } });
  useEffect(() => { const c = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); }; document.addEventListener('mousedown', c); return () => document.removeEventListener('mousedown', c); }, []);
  const unread = boot?.unreadNotifications ?? 0;
  const markAll = async () => { await api.post('/notifications/read-all'); qc.invalidateQueries({ queryKey: ['notifications'] }); qc.invalidateQueries({ queryKey: ['bootstrap'] }); };
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} className="relative grid h-11 w-11 place-items-center rounded-full border border-white/[0.08] bg-white/[0.04] transition hover:bg-white/[0.09]"><Bell className="h-[18px] w-[18px]" />
        {unread > 0 && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-violet-600 px-1 text-[10px] font-bold ring-2 ring-ink">{unread > 9 ? '9+' : unread}</motion.span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.97 }} className="glass-strong absolute right-0 top-14 z-50 w-[min(92vw,380px)] rounded-2xl p-2">
            <div className="flex items-center justify-between px-3 py-2"><p className="font-bold">Notifications</p>{unread > 0 && <button onClick={markAll} className="text-xs font-semibold text-violet-300 hover:text-violet-200">Mark all read</button>}</div>
            <div className="max-h-80 overflow-y-auto">
              {!data ? <div className="space-y-2 p-2"><Skeleton className="h-14" /><Skeleton className="h-14" /></div> : data.items.length === 0 ? <p className="px-3 py-8 text-center text-sm text-fg-mute">You are all caught up.</p> :
                data.items.slice(0, 6).map((n) => (
                  <button key={n.id} onClick={() => { setOpen(false); api.post(`/notifications/${n.id}/read`).then(() => { qc.invalidateQueries({ queryKey: ['bootstrap'] }); }); nav(n.link || '/app/notifications'); }} className="flex w-full gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/[0.06]">
                    <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-violet-400')} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{n.title}</span><span className="line-clamp-1 text-xs text-fg-mute">{n.body}</span></span><span className="shrink-0 text-[11px] text-fg-faint">{timeAgo(n.createdAt)}</span>
                  </button>))}
            </div>
            <Link to="/app/notifications" onClick={() => setOpen(false)} className="mt-1 block rounded-xl px-3 py-2.5 text-center text-sm font-semibold text-violet-300 hover:bg-white/[0.05]">View all</Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const UserMenu = () => {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const nav = useNavigate();
  useEffect(() => { const c = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); }; document.addEventListener('mousedown', c); return () => document.removeEventListener('mousedown', c); }, []);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-label="Account menu" aria-expanded={open} className="rounded-full ring-2 ring-white/10 transition hover:ring-violet-400/60"><Avatar name={user?.name} url={user?.avatarUrl} size={44} /></button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.97 }} className="glass-strong absolute right-0 top-14 z-50 w-64 rounded-2xl p-2">
            <div className="border-b border-line px-3 pb-3 pt-2"><p className="truncate font-bold">{user?.name}</p><p className="truncate text-xs text-fg-mute">{user?.email}</p></div>
            <div className="py-1">
              <MenuBtn icon={<UserRound className="h-4 w-4" />} onClick={() => { setOpen(false); nav('/app/profile'); }}>Profile</MenuBtn>
              <MenuBtn icon={<CreditCard className="h-4 w-4" />} onClick={() => { setOpen(false); nav('/app/billing'); }}>Billing</MenuBtn>
              <MenuBtn icon={<Settings2 className="h-4 w-4" />} onClick={() => { setOpen(false); nav('/app/profile?tab=security'); }}>Security</MenuBtn>
            </div>
            <div className="border-t border-line pt-1"><MenuBtn icon={<LogOut className="h-4 w-4" />} onClick={async () => { await logout(); nav('/', { replace: true }); }}>Sign out</MenuBtn></div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
const MenuBtn = ({ icon, children, onClick }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void }) => <button onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-fg-soft transition hover:bg-white/[0.07] hover:text-white">{icon}{children}</button>;

export default function AppShell() {
  useRealtime();
  const { data } = useBootstrap();
  const setMobileNav = useUi((s) => s.setMobileNav);
  const loc = useLocation();
  const items = useNav(data?.unreadNotifications ?? 0, data?.unreadChat ?? 0);
  useEffect(() => { setMobileNav(false); window.scrollTo({ top: 0 }); }, [loc.pathname, setMobileNav]);
  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex min-h-screen">
        <Sidebar items={items} area="app" footer={<CreditsCard />} />
        <div className="relative min-w-0 flex-1">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] overflow-hidden"><div className="aurora opacity-60" /></div>
          <header className="sticky top-0 z-40 flex h-[76px] items-center gap-3 border-b border-line/60 bg-ink/70 px-4 backdrop-blur-2xl sm:px-8">
            <button className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-white/[0.04] lg:hidden" onClick={() => setMobileNav(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
            <SearchBox />
            <div className="ml-auto flex items-center gap-3"><Bell_ /><UserMenu /></div>
          </header>
          {/* Enter-only transition: an exit animation around <Outlet/> can hang and leave the page at opacity 0. */}
          <motion.main key={loc.pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }} className="relative mx-auto max-w-[1360px] px-4 py-8 sm:px-8"><Outlet /></motion.main>
        </div>
      </div>
    </TooltipProvider>
  );
}
export { NavLink };