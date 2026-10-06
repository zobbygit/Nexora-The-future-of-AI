import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { BarChart3, Bot, CreditCard, LayoutDashboard, LifeBuoy, LogOut, Megaphone, Menu, Search, Server, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar, type NavItem } from '@/components/layout/Sidebar';
import { Avatar } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { TooltipProvider } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuth } from '@/store/auth';
import { toast, useUi } from '@/store/ui';
import { useQueryClient } from '@tanstack/react-query';

const SearchBox = () => {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const { data } = useQuery({ queryKey: ['admin-search', q], enabled: q.trim().length >= 2, queryFn: async () => (await api.get('/admin/search', { params: { q } })).data, staleTime: 10_000 });
  useEffect(() => { const c = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); }; document.addEventListener('mousedown', c); return () => document.removeEventListener('mousedown', c); }, []);
  const go = (to: string) => { setOpen(false); setQ(''); nav(to); };
  const groups: [string, { label: string; sub?: string; to: string }[]][] = data ? [
    ['Users', data.users.map((u: any) => ({ label: u.name, sub: u.email, to: `/admin/users/${u.id}` }))],
    ['Generations', data.generations.map((g: any) => ({ label: g.title || g.tool, sub: `${g.tool} · ${g.status}`, to: `/admin/ai?q=${encodeURIComponent(g.title || g.tool)}` }))],
    ['Reports', data.reports.map((r: any) => ({ label: r.subject, sub: r.status, to: `/admin/support?report=${r.id}` }))],
    ['Audit logs', data.audit.map((a: any) => ({ label: a.action, sub: a.target, to: '/admin/system?tab=audit' }))],
    ['Credit transactions', data.transactions.map((t: any) => ({ label: t.reason || t.type, sub: `${t.amount}`, to: '/admin/billing?tab=credits' }))],
  ] : [];
  const any = groups.some(([, i]) => i.length);
  return (
    <div ref={ref} className="relative min-w-0 flex-1 md:max-w-xl">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-mute" />
      <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder="Search users, generations, reports, logs…" aria-label="Admin search" className="h-11 w-full rounded-full border border-white/[0.08] bg-white/[0.04] pl-11 pr-4 text-sm outline-none transition focus:border-violet-500/60 focus:ring-4 focus:ring-violet-500/15" />
      <AnimatePresence>{open && q.trim().length >= 2 && <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="glass-strong absolute inset-x-0 top-14 z-50 max-h-[60vh] overflow-y-auto rounded-2xl p-2">
        {!any && <p className="px-3 py-6 text-center text-sm text-fg-mute">No results.</p>}
        {groups.filter(([, i]) => i.length).map(([g, items]) => <div key={g}><p className="label px-3 py-2">{g}</p>{items.map((it, i) => <button key={i} onClick={() => go(it.to)} className="flex w-full flex-col rounded-xl px-3 py-2 text-left transition hover:bg-white/[0.07]"><span className="truncate text-sm font-semibold">{it.label}</span>{it.sub && <span className="truncate text-xs text-fg-mute">{it.sub}</span>}</button>)}</div>)}
      </motion.div>}</AnimatePresence>
    </div>
  );
};

export default function AdminShell() {
  const { admin, adminLogout } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const loc = useLocation();
  const setMobileNav = useUi((s) => s.setMobileNav);
  const { data: conv } = useQuery({ queryKey: ['admin-conv-unread'], queryFn: async () => (await api.get('/admin/support/conversations')).data.totalUnread as number, refetchInterval: 60_000 });
  const items: NavItem[] = [
    { to: '/admin', label: 'Dashboard', icon: <LayoutDashboard />, end: true }, { to: '/admin/users', label: 'Users', icon: <Users /> }, { to: '/admin/ai', label: 'AI Management', icon: <Bot /> },
    { to: '/admin/billing', label: 'Billing', icon: <CreditCard /> }, { to: '/admin/support', label: 'Support', icon: <LifeBuoy />, badge: conv || 0 }, { to: '/admin/communication', label: 'Communication', icon: <Megaphone /> },
    { to: '/admin/analytics', label: 'Analytics', icon: <BarChart3 /> }, { to: '/admin/system', label: 'System', icon: <Server /> },
  ];
  useEffect(() => { setMobileNav(false); window.scrollTo({ top: 0 }); }, [loc.pathname, setMobileNav]);
  useEffect(() => {
    const s = getSocket('admin');
    const onEvent = (e: { kind: string; subject?: string; user?: string; name?: string; reply?: boolean }) => {
      if (e.kind === 'report') toast.info(e.reply ? 'Report reply' : 'New report', `${e.user}: ${e.subject}`);
      if (e.kind === 'registration') toast.info('New user', e.name);
      qc.invalidateQueries({ queryKey: ['admin-dash'] });
    };
    const onMsg = (m: { sender: string }) => { if (m.sender === 'user') qc.invalidateQueries({ queryKey: ['admin-conv-unread'] }); };
    s.on('admin:event', onEvent); s.on('chat:message', onMsg);
    return () => { s.off('admin:event', onEvent); s.off('chat:message', onMsg); };
  }, [qc]);
  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex min-h-screen">
        <Sidebar items={items} area="admin" label="ADMIN" footer={<div className="flex items-center gap-3 rounded-2xl border border-line bg-white/[0.03] p-3"><Avatar name="Admin" size={36} /><div className="min-w-0"><p className="truncate text-sm font-bold">Administrator</p><p className="truncate text-xs text-fg-mute">{admin?.email}</p></div></div>} />
        <div className="relative min-w-0 flex-1">
          <header className="sticky top-0 z-40 flex h-[76px] items-center gap-3 border-b border-line/60 bg-ink/70 px-4 backdrop-blur-2xl sm:px-8">
            <button className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-white/[0.04] lg:hidden" onClick={() => setMobileNav(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
            <SearchBox />
            <Button variant="secondary" className="ml-auto" onClick={async () => { await adminLogout(); nav('/admin/login', { replace: true }); }}><LogOut className="h-4 w-4" /><span className="hidden sm:inline">Sign out</span></Button>
          </header>
          <motion.main key={loc.pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="mx-auto max-w-[1400px] px-4 py-8 sm:px-8"><Outlet /></motion.main>
        </div>
      </div>
    </TooltipProvider>
  );
}