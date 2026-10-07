import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Logo, LogoMark } from '@/components/brand/Logo';
import { Tooltip } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { useUi } from '@/store/ui';

export interface NavItem { to: string; label: string; icon: ReactNode; end?: boolean; badge?: number; children?: { group: string; items: { to: string; label: string; icon: ReactNode; pro?: boolean }[] }[] }

const W_OPEN = 280, W_CLOSED = 76;

const Item = ({ item, collapsed, onNavigate }: { item: NavItem; collapsed: boolean; onNavigate: () => void }) => {
  const loc = useLocation();
  const inSection = item.children ? loc.pathname.startsWith(item.to) : false;
  const [open, setOpen] = useState(inSection);
  const link = (
    <NavLink to={item.to} end={item.end} onClick={onNavigate} 
      className={({ isActive }) => cn('group relative flex h-11 items-center gap-3 rounded-2xl px-3.5 text-[14px] font-semibold outline-none transition-colors', collapsed && 'justify-center px-0', isActive ? 'text-white' : 'text-fg-mute hover:bg-white/[0.05] hover:text-fg')}>
      {({ isActive }) => (<>
        {isActive && 
        <motion.span layoutId={`nav-active-${collapsed}`} className="absolute inset-0 rounded-2xl border border-violet-400/25 bg-gradient-to-r from-violet-500/25 to-sky2/10" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
        {isActive && <motion.span layoutId="nav-bar" className="absolute -left-3 h-6 w-1 rounded-full bg-violet-400" />}
        <span className="relative grid h-5 w-5 shrink-0 place-items-center [&_svg]:h-[19px] [&_svg]:w-[19px]">{item.icon}</span>
        {!collapsed && <span className="relative flex-1 truncate">{item.label}</span>}
        {!collapsed && !!item.badge && item.badge > 0 && <span className="relative grid h-5 min-w-5 place-items-center rounded-full bg-violet-600 px-1.5 text-[10px] font-bold leading-none">{item.badge > 99 ? '99+' : item.badge}</span>}
        {collapsed && !!item.badge && item.badge > 0 && <span className="absolute right-3 top-2.5 h-2 w-2 rounded-full bg-violet-400 ring-2 ring-ink-800" />}
      </>)}
    </NavLink>
  );
  return (
    <li>
      <div className="flex items-center">
        <div className="flex-1">{collapsed ? <Tooltip label={item.label}>{link}</Tooltip> : link}</div>
        {item.children && !collapsed && <button onClick={() => setOpen((o) => !o)} aria-label={`Toggle ${item.label}`} aria-expanded={open} className="ml-1 grid h-8 w-8 place-items-center rounded-lg text-fg-faint transition hover:bg-white/[0.06] hover:text-fg"><ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} /></button>}
      </div>
      <AnimatePresence initial={false}>
        {item.children && !collapsed && open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
            <div className="ml-[22px] mt-1 space-y-3 border-l border-line py-2 pl-3">
              {item.children.map((g) => (
                <div key={g.group}>
                  <p className="mb-1 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-fg-faint">{g.group}</p>
                  {g.items.map((c) => (
                    <NavLink key={c.to} to={c.to} onClick={onNavigate} className={({ isActive }) => cn('flex h-9 items-center gap-2.5 rounded-xl px-2.5 text-[13px] font-semibold transition-colors', isActive ? 'bg-white/[0.08] text-white' : 'text-fg-mute hover:bg-white/[0.05] hover:text-fg')}>
                      <span className="[&_svg]:h-4 [&_svg]:w-4">{c.icon}</span><span className="flex-1 truncate">{c.label}</span>
                      <span className={cn('rounded-full px-1.5 py-px text-[9px] font-bold', c.pro ? 'border border-amber-400/40 text-amber-300' : 'bg-ok/10 text-ok')}>{c.pro ? 'PRO' : 'FREE'}</span>
                    </NavLink>
                  ))}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
};

const Panel = ({ items, area, collapsed, footer, mobile, onNavigate, label }: { items: NavItem[]; area: 'app' | 'admin'; collapsed: boolean; footer?: ReactNode; mobile?: boolean; onNavigate: () => void; label?: string }) => {
  const toggle = useUi((s) => s.toggleCollapsed);
  return (
    <div className="flex h-full flex-col">
      <div className={cn('flex h-[72px] shrink-0 items-center', collapsed ? 'justify-center' : 'justify-between px-5')}>
        {collapsed ? <LogoMark className="h-9 w-9" /> : <div className="flex items-center gap-2.5"><Logo />{label && <span className="rounded-md border border-amber-400/40 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-amber-300">{label}</span>}</div>}
        {mobile && <button onClick={onNavigate} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10" aria-label="Close menu"><X className="h-5 w-5" /></button>}
      </div>
      <nav aria-label="Sidebar" className="flex-1 overflow-y-auto overflow-x-hidden px-3 pb-4"><ul className="space-y-1">{items.map((i) => <Item key={i.to} item={i} collapsed={collapsed} onNavigate={onNavigate} />)}</ul></nav>
      <div className="shrink-0 space-y-3 border-t border-line p-3">
        {footer && !collapsed && footer}
        {!mobile && (
          <Tooltip label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            <button onClick={() => toggle(area)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className={cn('flex h-10 w-full items-center gap-3 rounded-xl text-[13px] font-semibold text-fg-mute transition hover:bg-white/[0.06] hover:text-fg', collapsed ? 'justify-center' : 'px-3.5')}>
              {collapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <><PanelLeftClose className="h-[18px] w-[18px]" />Collapse</>}
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  );
};

export const Sidebar = ({ items, area, footer, label }: { items: NavItem[]; area: 'app' | 'admin'; footer?: ReactNode; label?: string }) => {
  const { collapsed, mobileNav, setMobileNav } = useUi();
  const c = collapsed[area];
  return (
    <>
      <motion.aside initial={false} animate={{ width: c ? W_CLOSED : W_OPEN }} transition={{ type: 'spring', stiffness: 260, damping: 32, mass: 0.9 }}
        className="sticky top-0 hidden h-screen shrink-0 border-r border-line bg-ink-800/70 backdrop-blur-xl lg:block" aria-label="Sidebar navigation">
        <Panel items={items} area={area} collapsed={c} footer={footer} onNavigate={() => undefined} label={label} />
      </motion.aside>
      <AnimatePresence>
        {mobileNav && (
          <>
            <motion.div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileNav(false)} />
            <motion.aside className="fixed inset-y-0 left-0 z-[71] w-[300px] max-w-[86vw] border-r border-line bg-ink-800 lg:hidden" initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', stiffness: 320, damping: 34 }}>
              <Panel items={items} area={area} collapsed={false} footer={footer} mobile onNavigate={() => setMobileNav(false)} label={label} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
