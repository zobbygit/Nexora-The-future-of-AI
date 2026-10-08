import { AnimatePresence, motion, useScroll, useTransform } from 'framer-motion';
import {
  ArrowRight, AudioLines, BarChart3, Briefcase, Check, ChevronDown, Clapperboard, Code2, FileStack, FileText, FolderKanban, Image as ImageIcon, Layers, Lock, Menu, Play, Share2, ShieldCheck, Sparkles, Table2, Users, X, Zap,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '@/components/brand/Logo';
import { Prism } from '@/components/brand/Prism';
import { Reveal } from '@/components/shared/Reveal';
import { Button } from '@/components/ui/Button';
import { Tilt } from '@/components/ui/Tilt';
import { Modal } from '@/components/ui/primitives';
import { CATEGORIES, TOOL_META } from '@/lib/tools';
import { cn } from '@/lib/utils';
import { useAuth } from '@/store/auth';
import LegalModals from '@/components/brand/LegalModals';

const NAV = [['Features', 'features'], ['AI Tools', 'tools'], ['Pricing', 'pricing'], ['Testimonials', 'testimonials'], ['FAQ', 'faq']] as const;
const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

const Navbar = () => {
  const user = useAuth((s) => s.user);
  const [open, setOpen] = useState(false);
  const [solid, setSolid] = useState(false);
  useEffect(() => { const f = () => setSolid(window.scrollY > 24); f(); window.addEventListener('scroll', f, { passive: true }); return () => window.removeEventListener('scroll', f); }, []);
  const go = (id: string) => { setOpen(false); setTimeout(() => scrollTo(id), open ? 250 : 0); };
  return (
    <header className={cn('fixed inset-x-0 top-0 z-50 transition-all duration-300', solid && 'border-b border-line bg-ink/70 backdrop-blur-2xl')}>
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link to="/" aria-label="Nexora home"><Logo /></Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {NAV.map(([label, id]) => <button key={id} onClick={() => go(id)} className="rounded-full px-4 py-2 text-[13.5px] font-semibold text-fg-soft transition hover:bg-white/[0.06] hover:text-white">{label}</button>)}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          {user ? <Button asChild variant="light"><Link to="/app">Open workspace</Link></Button> : (<>
            <Button asChild variant="ghost"><Link to="/login">Sign in</Link></Button>
            <Button asChild variant="light"><Link to="/register">Get Started</Link></Button></>)}
        </div>
        <button className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 lg:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu">{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden border-b border-line bg-ink/95 backdrop-blur-2xl lg:hidden">
            <div className="flex flex-col gap-1 px-5 pb-5">
              {NAV.map(([label, id]) => <button key={id} onClick={() => go(id)} className="rounded-xl px-3 py-3 text-left text-[15px] font-semibold text-fg-soft hover:bg-white/5">{label}</button>)}
              <div className="mt-2 grid grid-cols-2 gap-2"><Button asChild variant="secondary"><Link to="/login">Sign in</Link></Button><Button asChild variant="light"><Link to="/register">Get Started</Link></Button></div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

const CHIPS = [
  { label: 'Write', x: '4%', y: '58%', d: 0, depth: 24, tone: 'from-rose-500 to-orange-400' },
  { label: 'Generate', x: '-2%', y: '76%', d: 0.6, depth: 36, tone: 'from-violet-500 to-indigo-500' },
  { label: 'Analyze', x: '72%', y: '48%', d: 0.3, depth: 30, tone: 'from-sky-500 to-blue-500' },
  { label: 'Collaborate', x: '80%', y: '68%', d: 0.9, depth: 42, tone: 'from-purple-500 to-fuchsia-500' },
  { label: 'Create', x: '66%', y: '84%', d: 0.5, depth: 20, tone: 'from-emerald-400 to-teal-500' },
];

const Hero = ({ onDemo }: { onDemo: () => void }) => {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 140]);
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  return (
    <section ref={ref} className="relative overflow-hidden pt-[120px]" onPointerMove={(e) => setMouse({ x: e.clientX / window.innerWidth - 0.5, y: e.clientY / window.innerHeight - 0.5 })}>
      <div className="aurora" />
      <svg className="ribbon top-[36%] h-[420px] w-full opacity-70" viewBox="0 0 1440 420" preserveAspectRatio="none" aria-hidden>
        <defs><linearGradient id="rb" x1="0" x2="1"><stop offset="0" stopColor="#7c5cff" stopOpacity="0" /><stop offset=".3" stopColor="#8b5cf6" /><stop offset=".7" stopColor="#4f8bff" /><stop offset="1" stopColor="#4f8bff" stopOpacity="0" /></linearGradient></defs>
        {[0, 1, 2].map((i) => <motion.path key={i} d={`M-40 ${300 - i * 22} C 300 ${120 + i * 30}, 620 ${420 - i * 20}, 940 ${230 - i * 12} S 1360 ${110 + i * 16}, 1500 ${190 - i * 8}`} stroke="url(#rb)" strokeWidth={1.5 - i * 0.4} fill="none" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 0.85 - i * 0.2 }} transition={{ duration: 2.4, delay: 0.3 + i * 0.25, ease: 'easeInOut' }} />)}
      </svg>
      <motion.div style={{ y, opacity: fade }} className="relative mx-auto flex max-w-7xl flex-col items-center px-5 text-center sm:px-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass mb-7 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold text-fg-soft">
          <Sparkles className="h-3.5 w-3.5 text-violet-300" /> All-in-One AI Workspace
        </motion.div>
        <h1 className="text-[clamp(2.6rem,7.4vw,5.6rem)] font-extrabold leading-[1.02] tracking-[-0.035em]">
          {['Create.', 'Collaborate.'].map((w, i) => <motion.span key={w} className="mr-[0.25em] inline-block" initial={{ opacity: 0, y: 40, filter: 'blur(10px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ delay: 0.15 + i * 0.12, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}>{w}</motion.span>)}
          <br />
          <motion.span className="inline-block" initial={{ opacity: 0, y: 40, filter: 'blur(10px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ delay: 0.4, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}>Do More <span className="text-gradient">with AI.</span></motion.span>
        </h1>
        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="mt-6 max-w-xl text-[17px] leading-8 text-fg-soft">
          Nexora gives you 13 powerful AI tools, a personal workspace, and seamless collaboration — all in one place.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.85 }} className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg"><Link to="/register">Get Started Free <ArrowRight className="h-4 w-4" /></Link></Button>
          <Button size="lg" variant="secondary" onClick={onDemo}><span className="grid h-6 w-6 place-items-center rounded-full bg-white/15"><Play className="h-3 w-3 fill-current" /></span>Watch Demo</Button>

          
        </motion.div>

        <div className="relative mt-4 h-[380px] w-full max-w-4xl sm:h-[470px]">
          <Prism className="absolute left-1/2 top-2 w-[300px] -translate-x-1/2 sm:w-[440px]" />
          {CHIPS.map((c) => (
            <motion.div key={c.label} className="absolute hidden sm:block" style={{ left: c.x, top: c.y }} animate={{ x: mouse.x * c.depth * -1.4, y: mouse.y * c.depth * -1 }} transition={{ type: 'spring', stiffness: 80, damping: 14 }}>
              <motion.div initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1 + c.d * 0.5 }}>
                <div className="animate-floaty glass-strong flex items-center gap-3 rounded-2xl py-2.5 pl-2.5 pr-5 text-sm font-semibold" style={{ animationDelay: `${c.d}s`, rotate: `${(c.d - 0.45) * 8}deg` }}>
                  <span className={cn('grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br shadow-lg', c.tone)}><Sparkles className="h-4 w-4" /></span>{c.label}
                </div>
              </motion.div>
            </motion.div>
          ))}
        </div>

        <div className="mt-2 grid w-full max-w-4xl grid-cols-2 gap-y-8 sm:grid-cols-4">
          {[['13', 'AI Tools'], ['5', 'AI Providers'], ['10x', 'More Productivity'], ['100%', 'Your Creativity']].map(([n, l], i) => (
            <Reveal key={l} delay={i * 0.08}><div className="text-4xl font-extrabold tracking-tight">{n}</div><div className="mt-1 text-sm text-fg-mute">{l}</div></Reveal>
          ))}
        </div>
      </motion.div>
    </section>
  );
};

const PROVIDERS = ['OpenRouter', 'Groq', 'Hugging Face', 'Cloudflare', 'Clipdrop'];
const Providers = () => (
  <section className="relative mx-auto mt-24 max-w-6xl px-5 sm:px-8" aria-label="Provider ecosystem">
    <Reveal className="flex flex-col items-center gap-6 rounded-3xl border border-line bg-white/[0.02] px-6 py-7 md:flex-row md:justify-between">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-fg-faint">Powered by</span>
      <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
        {PROVIDERS.map((p) => <span key={p} className="text-[17px] font-extrabold tracking-tight text-fg-soft transition hover:text-white">{p}</span>)}
      </div>
    </Reveal>
  </section>
);

const SectionHead = ({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) => (
  <Reveal className="mx-auto max-w-2xl text-center">
    <p className="label text-violet-300">{eyebrow}</p>
    <h2 className="mt-3 text-[clamp(1.9rem,4.2vw,3rem)] font-extrabold leading-[1.1] tracking-[-0.03em]">{title}</h2>
    {body && <p className="mt-4 text-base leading-7 text-fg-mute">{body}</p>}
  </Reveal>
);

const FEATURES = [
  { icon: Layers, title: '13 AI Tools', body: 'Text, image, audio, video, documents and data — in one place.', tone: 'from-violet-500 to-indigo-500' },
  { icon: FolderKanban, title: 'Smart Workspace', body: 'Organize, preview and export everything you create.', tone: 'from-teal-400 to-emerald-500' },
  { icon: Users, title: 'Real Collaboration', body: 'Share as viewer or editor and work together live.', tone: 'from-sky-500 to-blue-500' },
  { icon: Zap, title: 'Multiple AI Providers', body: 'Automatic fallback keeps generations flowing when one provider is busy.', tone: 'from-blue-500 to-cyan-400' },
  { icon: ShieldCheck, title: 'Secure & Private', body: 'Your data, your control. Files are validated and access is enforced server-side.', tone: 'from-orange-400 to-amber-500' },
  { icon: Sparkles, title: 'Beautiful & Modern UI', body: 'Built for 2026 and beyond, with motion that respects your settings.', tone: 'from-purple-500 to-fuchsia-500' },
];
const Features = () => (
  <section id="features" className="mx-auto mt-32 max-w-7xl scroll-mt-24 px-5 sm:px-8">
    <SectionHead eyebrow="AI capabilities" title="Everything you need to create, explore and collaborate" body="From writing and coding to image, audio and video — Nexora brings the most powerful AI tools together in one seamless workspace." />
    <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {FEATURES.map((f, i) => (
        <Reveal key={f.title} delay={(i % 3) * 0.08}>
          <Tilt className="surface h-full p-6"><span className={cn('grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br shadow-lg', f.tone)}><f.icon className="h-5 w-5" /></span>
            <h3 className="mt-5 text-lg font-bold">{f.title}</h3><p className="mt-2 text-sm leading-6 text-fg-mute">{f.body}</p></Tilt>
        </Reveal>
      ))}
    </div>
  </section>
);

const Tools = () => {
  const [cat, setCat] = useState<string>('All');
  const list = TOOL_META.filter((t) => cat === 'All' || t.category === cat);
  return (
    <section id="tools" className="mx-auto mt-32 max-w-7xl scroll-mt-24 px-5 sm:px-8">
      <SectionHead eyebrow="Tool categories" title="Thirteen tools. Five ways to work." body="Every tool has an interface built for its own workflow — not one generic form with a new title." />
      <Reveal className="mt-10 flex flex-wrap justify-center gap-2">
        {['All', ...CATEGORIES].map((c) => <button key={c} onClick={() => setCat(c)} className={cn('rounded-full border px-4 py-2 text-[13px] font-semibold transition', cat === c ? 'border-violet-400/60 bg-violet-500/20 text-white shadow-glow' : 'border-white/10 text-fg-mute hover:border-white/25 hover:text-fg')}>{c}</button>)}
      </Reveal>
      <motion.div layout className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AnimatePresence mode="popLayout">
          {list.map((t) => (
            <motion.div layout key={t.id} initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }} transition={{ duration: 0.3 }}>
              <Tilt className="surface relative h-full p-5" max={9}>
                {!t.free && <span className="absolute right-4 top-4 rounded-full border border-amber-400/50 px-2 py-0.5 text-[10px] font-bold text-amber-300">Pro</span>}
                <span className={cn('grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br shadow-lg', t.tile)}><t.icon className="h-5 w-5" /></span>
                <h3 className="mt-4 font-bold">{t.name}</h3><p className="mt-1.5 text-[13px] leading-5 text-fg-mute">{t.blurb}</p>
              </Tilt>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </section>
  );
};

const HowItWorks = () => (
  <section className="mx-auto mt-32 max-w-6xl px-5 sm:px-8">
    <SectionHead eyebrow="How it works" title="From idea to finished work in three moves" />
    <div className="relative mt-14 grid gap-6 md:grid-cols-3">
      <div aria-hidden className="absolute left-[16%] right-[16%] top-8 hidden h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent md:block" />
      {[['01', 'Choose a tool', 'Pick from writing, audio, vision, documents or automation.'], ['02', 'Describe or upload', 'Type a prompt or drop a file. Credit cost is shown before you run.'], ['03', 'Refine and share', 'Preview inside Nexora, export as PDF, or invite a collaborator.']].map(([n, t, b], i) => (
        <Reveal key={n} delay={i * 0.12} className="relative text-center">
          <div className="relative mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-violet-400/30 bg-ink-800 text-lg font-extrabold text-violet-300 shadow-glow">{n}</div>
          <h3 className="mt-5 text-lg font-bold">{t}</h3><p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-fg-mute">{b}</p>
        </Reveal>
      ))}
    </div>
  </section>
);

const Showcase = () => (
  <section className="mx-auto mt-32 max-w-7xl px-5 sm:px-8">
    <div className="grid items-center gap-10 lg:grid-cols-2">
      <Reveal>
        <p className="label text-violet-300">Workspace</p>
        <h2 className="mt-3 text-[clamp(1.9rem,4vw,2.8rem)] font-extrabold leading-[1.1] tracking-[-0.03em]">Everything you make, kept and previewable</h2>
        <p className="mt-4 text-base leading-7 text-fg-mute">Every generation becomes an artifact in your workspace. Read documents, play audio, compare images and explore data without leaving Nexora.</p>
        <ul className="mt-7 space-y-3.5">
          {[[FileStack, 'Search, filter and favorite across every file type'], [Share2, 'Share as viewer or editor with any Nexora user'], [BarChart3, 'Charts and tables that explain your data, not decorate it']].map(([I, t], i) => {
            const Icon = I as typeof Share2; return <li key={i} className="flex items-start gap-3 text-[15px] text-fg-soft"><span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-violet-500/15 text-violet-300"><Icon className="h-4 w-4" /></span>{t as string}</li>;
          })}
        </ul>
      </Reveal>
      <Reveal delay={0.1}><Tilt className="glass-strong rounded-3xl p-4" max={5}><MiniDashboard /></Tilt></Reveal>
    </div>
  </section>
);

const MiniDashboard = () => (
  <div className="overflow-hidden rounded-2xl border border-line bg-ink-800 p-4">
    <div className="flex items-center justify-between"><div><p className="text-xs text-fg-mute">Good evening,</p><p className="text-xl font-extrabold">Alex</p></div>
      <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-right"><p className="text-[11px] font-bold text-amber-300">Pro Plan</p><p className="text-[11px] text-fg-mute">3,000 credits</p></div></div>
    <div className="mt-4 grid grid-cols-4 gap-2">{TOOL_META.filter((t) => ['writer', 'text-to-image', 'pdf', 'code'].includes(t.id)).map((t) => <div key={t.id} className="rounded-xl border border-line bg-white/[0.03] p-2.5"><span className={cn('grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br', t.tile)}><t.icon className="h-3.5 w-3.5" /></span><p className="mt-2 truncate text-[11px] font-bold">{t.name}</p></div>)}</div>
    <div className="mt-3 grid grid-cols-5 gap-2">
      <div className="col-span-3 rounded-xl border border-line bg-white/[0.03] p-3"><p className="text-[11px] font-bold">Usage overview</p>
        <div className="mt-3 flex h-24 items-end gap-2">{[40, 62, 55, 88, 100, 48, 82].map((h, i) => <motion.div key={i} className="flex-1 rounded-t-md bg-gradient-to-t from-violet-700 to-violet-400" initial={{ height: 0 }} whileInView={{ height: `${h}%` }} viewport={{ once: true }} transition={{ delay: 0.2 + i * 0.07, duration: 0.7 }} />)}</div></div>
      <div className="col-span-2 space-y-2 rounded-xl border border-line bg-white/[0.03] p-3"><p className="text-[11px] font-bold">Recent</p>{['Blog: Future of AI', 'A futuristic workspace', 'Research summary'].map((r) => <p key={r} className="truncate rounded-lg bg-white/[0.04] px-2 py-1.5 text-[11px] text-fg-soft">{r}</p>)}</div>
    </div>
  </div>
);

const Collaboration = () => (
  <section className="mx-auto mt-32 max-w-7xl px-5 sm:px-8">
    <div className="grid items-center gap-10 lg:grid-cols-2">
      <Reveal className="order-2 lg:order-1"><Tilt className="surface p-6" max={5}>
        <div className="flex items-center justify-between"><p className="font-bold">Q3 launch brief</p><span className="rounded-full bg-ok/15 px-2.5 py-1 text-[11px] font-bold text-ok">2 collaborators</span></div>
        {[['Priya S.', 'Editor', 'from-rose-500 to-orange-400'], ['Marco D.', 'Viewer', 'from-sky-500 to-blue-500']].map(([n, r, g]) => (
          <div key={n} className="mt-3 flex items-center justify-between rounded-2xl border border-line bg-white/[0.03] px-4 py-3"><div className="flex items-center gap-3"><span className={cn('grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br text-sm font-bold', g)}>{n[0]}</span><span className="text-sm font-semibold">{n}</span></div><span className="text-xs font-bold text-fg-mute">{r}</span></div>
        ))}
        <div className="mt-4 flex gap-2"><div className="field flex-1 !py-2 text-fg-faint">Add by name or email</div><div className="grid place-items-center rounded-xl bg-violet-600 px-4 text-sm font-bold">Invite</div></div>
      </Tilt></Reveal>
      <Reveal delay={0.1} className="order-1 lg:order-2">
        <p className="label text-violet-300">Collaboration</p>
        <h2 className="mt-3 text-[clamp(1.9rem,4vw,2.8rem)] font-extrabold leading-[1.1] tracking-[-0.03em]">Work together, with the right level of access</h2>
        <p className="mt-4 text-base leading-7 text-fg-mute">Invite teammates by name or email. Viewers can read and, if you allow it, download. Editors can change the content — and everyone sees updates as they happen.</p>
      </Reveal>
    </div>
  </section>
);


const FreeVsPro = () => (
  <section className="mx-auto mt-32 max-w-5xl px-5 sm:px-8">
    <SectionHead eyebrow="Free vs Pro" title="Five tools free. Thirteen with Pro." body="Start with the essentials every day, then unlock audio, vision, data and video when you need them." />
    <Reveal className="mt-12 overflow-hidden rounded-3xl border border-line bg-ink-800/70">
      <div className="grid grid-cols-[1fr_88px_88px] items-center border-b border-line bg-white/[0.03] px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-fg-mute sm:grid-cols-[1fr_120px_120px]"><span>Tool</span><span className="text-center">Free</span><span className="text-center text-amber-300">Pro</span></div>
      {TOOL_META.map((t) => (
        <div key={t.id} className="grid grid-cols-[1fr_88px_88px] items-center border-b border-line px-5 py-3 last:border-0 sm:grid-cols-[1fr_120px_120px]">
          <span className="flex items-center gap-3 text-sm font-semibold"><span className={cn('grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br', t.tile)}><t.icon className="h-4 w-4" /></span>{t.name}</span>
          <span className="grid place-items-center">{t.free ? <Check className="h-4 w-4 text-violet-300" /> : <Lock className="h-3.5 w-3.5 text-fg-faint" />}</span>
          <span className="grid place-items-center"><Check className="h-4 w-4 text-amber-300" /></span>
        </div>
      ))}
      <div className="grid grid-cols-[1fr_88px_88px] items-center bg-white/[0.03] px-5 py-3 text-sm font-bold sm:grid-cols-[1fr_120px_120px]"><span>Credits</span><span className="text-center text-xs">20 / day</span><span className="text-center text-xs text-amber-300">3,000 / mo</span></div>
    </Reveal>
  </section>
);

const KINDS = [['Text & documents', 'Read and edit in an in-app editor', FileText], ['PDF', 'Inline viewer with page citations', FileStack], ['Images', 'Full-size view and before/after', ImageIcon], ['Audio', 'Waveform player and transcripts', AudioLines], ['Video', 'Built-in player with timestamps', Clapperboard], ['Code', 'Syntax-friendly blocks with copy', Code2], ['Resumes', 'Clean, printable preview', Briefcase], ['Data', 'Tables and charts that explain', Table2]] as const;
const ArtifactMgmt = () => (
  <section className="mx-auto mt-32 max-w-7xl px-5 sm:px-8">
    <SectionHead eyebrow="Artifact management" title="Preview everything without downloading it" body="Every result is an artifact. Open it in the right viewer, then download, export, favorite, share or delete — only the actions that make sense for that type." />
    <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {KINDS.map(([t, b, I], i) => <Reveal key={t} delay={(i % 4) * 0.06}><Tilt className="surface h-full p-5" max={8}><span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-500/15 text-violet-300"><I className="h-5 w-5" /></span><h3 className="mt-4 font-bold">{t}</h3><p className="mt-1 text-[13px] leading-5 text-fg-mute">{b}</p></Tilt></Reveal>)}
    </div>
  </section>
);

const ProviderEcosystem = () => (
  <section className="mx-auto mt-32 max-w-6xl px-5 sm:px-8">
    <SectionHead eyebrow="Provider ecosystem" title="Five providers. One reliable experience." body="Nexora routes every request to the best provider for the job and quietly falls back when one is busy — you are charged once, only on success." />
    <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {[['OpenRouter', 'Writing, resumes, code, documents'], ['Groq', 'Fast text and transcription'], ['Hugging Face', 'Speech, vision and images'], ['Cloudflare', 'Workers AI for text, voice, image'], ['Clipdrop', 'Background removal and upscaling']].map(([n, b], i) => (
        <Reveal key={n} delay={i * 0.07}><div className="surface h-full p-5 text-center"><p className="text-lg font-extrabold tracking-tight">{n}</p><p className="mt-2 text-[13px] leading-5 text-fg-mute">{b}</p></div></Reveal>
      ))}
    </div>
    <Reveal className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs font-semibold text-fg-mute">{['Primary', 'Fallback', 'Next compatible provider'].map((x, i) => <span key={x} className="flex items-center gap-3"><span className="rounded-full border border-white/10 px-3 py-1.5">{x}</span>{i < 2 && <ArrowRight className="h-3.5 w-3.5 text-violet-300" />}</span>)}</Reveal>
  </section>
);

const ProductPreview = () => (
  <section className="mx-auto mt-32 max-w-7xl px-5 sm:px-8">
    <SectionHead eyebrow="Product preview" title="A workspace designed to disappear" body="Quiet, fast and focused — so the work is what stands out." />
    <Reveal className="mt-12"><Tilt className="glass-strong rounded-[2rem] p-3 sm:p-5" max={3}>
      <div className="grid gap-3 sm:grid-cols-[1.1fr_1fr]">
        <MiniDashboard />
        <div className="overflow-hidden rounded-2xl border border-line bg-ink-800 p-4"><p className="text-lg font-extrabold">AI Tools</p><p className="text-xs text-fg-mute">13 powerful tools to help you create, analyze, and innovate.</p>
          <div className="mt-3 grid grid-cols-3 gap-2">{TOOL_META.slice(0, 9).map((t) => <div key={t.id} className="rounded-xl border border-line bg-white/[0.03] p-2.5"><span className={cn('grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br', t.tile)}><t.icon className="h-3.5 w-3.5" /></span><p className="mt-2 truncate text-[10px] font-bold">{t.name}</p></div>)}</div></div>
      </div>
    </Tilt></Reveal>
  </section>
);

const Plans = () => {
  const rows: [string, boolean, boolean][] = [['AI Writer, Resume, Code, PDF AI, Agent', true, true], ['20 credits every day', true, false], ['3,000 credits every month', false, true], ['Audio, Vision & Image tools', false, true], ['Data Analyzer & Video → Text', false, true], ['Workspace & collaboration', true, true]];
  return (
    <section id="pricing" className="mx-auto mt-32 max-w-5xl scroll-mt-24 px-5 sm:px-8">
      <SectionHead eyebrow="Free vs Pro" title="Simple pricing. Start free." body="Upgrade when you need the full toolkit. Cancel any time." />
      <div className="mt-14 grid gap-5 md:grid-cols-2">
        {[{ name: 'Free', price: '₹0', sub: 'forever', pro: false, cta: 'Start free' }, { name: 'Pro', price: '₹400', sub: 'per month', pro: true, cta: 'Go Pro' }].map((p, i) => (
          <Reveal key={p.name} delay={i * 0.1}>
            <Tilt className={cn('h-full rounded-3xl border p-7', p.pro ? 'border-violet-400/40 bg-gradient-to-b from-violet-500/[0.14] to-ink-800 shadow-glow' : 'border-line bg-ink-800/80')}>
              <div className="flex items-center justify-between"><h3 className="text-xl font-extrabold">{p.name}</h3>{p.pro && <span className="rounded-full border border-amber-400/50 px-2.5 py-0.5 text-[11px] font-bold text-amber-300">Most popular</span>}</div>
              <p className="mt-5"><span className="text-5xl font-extrabold tracking-tight">{p.price}</span> <span className="text-sm text-fg-mute">/ {p.sub}</span></p>
              <ul className="mt-7 space-y-3">{rows.map(([t, f, pr]) => { const on = p.pro ? pr : f; return <li key={t} className={cn('flex items-center gap-3 text-sm', on ? 'text-fg-soft' : 'text-fg-faint line-through decoration-white/20')}>{on ? <Check className="h-4 w-4 text-violet-300" /> : <Lock className="h-4 w-4" />}{t}</li>; })}</ul>
              <Button asChild size="lg" variant={p.pro ? 'primary' : 'secondary'} className="mt-8 w-full"><Link to="/register">{p.cta}</Link></Button>
            </Tilt>
          </Reveal>
        ))}
      </div>
    </section>
  );
};

// const Testimonials = () => (
//   <section id="testimonials" className="mx-auto mt-32 max-w-7xl scroll-mt-24 px-5 sm:px-8">
//     <SectionHead eyebrow="Testimonials" title="Made for people who ship" />
//     <div className="mt-12 grid gap-4 md:grid-cols-3">
//       {[['I replaced four separate subscriptions. The PDF assistant alone saves me an hour every day.', 'Ananya R.', 'Product manager'], ['The code assistant explains, debugs and refactors in one place. The workspace keeps everything tidy.', 'Rohan M.', 'Full-stack developer'], ['Sharing a draft as editor and watching my editor tweak it live felt like magic.', 'Sofia L.', 'Content lead']].map(([q, n, r], i) => (
//         <Reveal key={n} delay={i * 0.1}><Tilt className="surface h-full p-6"><p className="text-[15px] leading-7 text-fg-soft">“{q}”</p><div className="mt-6 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-sky2 font-bold">{n[0]}</span><div><p className="text-sm font-bold">{n}</p><p className="text-xs text-fg-mute">{r}</p></div></div></Tilt></Reveal>
//       ))}
//     </div>
//   </section>
// );

const TESTIMONIALS: [string, string, string][] = [
  // Original 3
  [
    'I replaced four separate subscriptions. The PDF assistant alone saves me an hour every day.',
    'Ananya R.',
    'Product manager',
  ],
  [
    'The code assistant explains, debugs and refactors in one place. The workspace keeps everything tidy.',
    'Rohan M.',
    'Full-stack developer',
  ],
  [
    'Sharing a draft as editor and watching my editor tweak it live felt like magic.',
    'Sofia L.',
    'Content lead',
  ],
  // 8 new dummy testimonials
  [
    'The AI Agent planned my entire research workflow and cited sources from the PDF I attached.',
    'Karan T.',
    'Research analyst',
  ],
  [
    'Background Remover gave me studio-quality cutouts in seconds. My design team stopped using the old tool.',
    'Meera J.',
    'Graphic designer',
  ],
  [
    'Billing is honest — I never get charged for a failed run. That alone earned my trust.',
    'Daniel O.',
    'Startup founder',
  ],
  [
    'I record client calls, drop the audio in, and get a timestamped transcript before I finish my coffee.',
    'Priya S.',
    'Sales consultant',
  ],
  [
    'The data analyzer found an outlier in my CSV that would have taken me an afternoon in a spreadsheet.',
    'Arjun K.',
    'Data scientist',
  ],
  [
    'Résumé AI rewrote my summary for an ATS and I got three callbacks the same week.',
    'Hannah W.',
    'Marketing lead',
  ],
  [
    'The admin console is honestly better than tools I pay ten times more for. Audit log is a lifesaver.',
    'Vikram N.',
    'IT administrator',
  ],
];

const TestimonialCard = ({
  quote,
  name,
  role,
}: {
  quote: string;
  name: string;
  role: string;
}) => (
  <Tilt className="surface w-[340px] shrink-0 p-6 sm:w-[380px]">
    <p className="text-[15px] leading-7 text-fg-soft">“{quote}”</p>
    <div className="mt-6 flex items-center gap-3">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-sky2 font-bold">
        {name[0]}
      </span>
      <div>
        <p className="text-sm font-bold">{name}</p>
        <p className="text-xs text-fg-mute">{role}</p>
      </div>
    </div>
  </Tilt>
);

const Testimonials = () => (
  <section
    id="testimonials"
    className="mx-auto mt-32 max-w-7xl scroll-mt-24 overflow-hidden px-5 sm:px-8"
  >
    <SectionHead eyebrow="Testimonials" title="Made for people who ship" />

    {/* Marquee viewport with fade edges */}
    <div className="group relative mt-12 overflow-hidden">
      {/* left fade */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-ink to-transparent sm:w-24" />
      {/* right fade */}
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-ink to-transparent sm:w-24" />

      {/* Track: two identical halves so the loop is seamless */}
      <div className="nexora-marquee flex w-max gap-4 group-hover:[animation-play-state:paused]">
        {/* Half 1 */}
        <div className="flex gap-4 pr-4">
          {TESTIMONIALS.map(([q, n, r], i) => (
            <TestimonialCard key={`a-${n}-${i}`} quote={q} name={n} role={r} />
          ))}
        </div>
        {/* Half 2 — duplicate, aria-hidden so screen readers don't double-announce */}
        <div className="flex gap-4 pr-4" aria-hidden="true">
          {TESTIMONIALS.map(([q, n, r], i) => (
            <TestimonialCard key={`b-${n}-${i}`} quote={q} name={n} role={r} />
          ))}
        </div>
      </div>
    </div>
  </section>
);


const FAQS = [['What do I get on the Free plan?', 'Five tools — AI Writer, Resume & Cover, Code Assistant, PDF AI and AI Agent — with 20 credits that reset every day.'], ['What happens if a provider is down?', 'Nexora automatically retries with a fallback provider. It counts as one generation and one charge, and if everything fails you are not charged at all.'], ['How does billing work?', 'Pro is ₹400 per month via Stripe. You can cancel any time from Billing and keep access until the period ends.'], ['Can I share what I create?', 'Yes. Share any artifact with another Nexora user as a viewer or an editor, and change or revoke access whenever you like.'], ['How do I recover my account?', 'When you sign up we show you a one-time recovery code. Use it with your email to reset your password.']];
const Faq = () => {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="mx-auto mt-32 max-w-3xl scroll-mt-24 px-5 sm:px-8">
      <SectionHead eyebrow="FAQ" title="Questions, answered" />
      <div className="mt-10 space-y-3">
        {FAQS.map(([q, a], i) => (
          <Reveal key={q} delay={i * 0.05}><div className="surface overflow-hidden">
            <button className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left font-semibold" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>{q}<ChevronDown className={cn('h-5 w-5 shrink-0 text-fg-mute transition-transform', open === i && 'rotate-180 text-violet-300')} /></button>
            <AnimatePresence initial={false}>{open === i && <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden"><p className="px-6 pb-5 text-sm leading-7 text-fg-mute">{a}</p></motion.div>}</AnimatePresence>
          </div></Reveal>
        ))}
      </div>
    </section>
  );
};

const FinalCta = () => (
  <section className="mx-auto mt-32 max-w-6xl px-5 sm:px-8">
    <Reveal className="relative overflow-hidden rounded-[2rem] border border-violet-400/25 px-6 py-16 text-center sm:px-16">
      <div className="aurora opacity-80" /><div className="absolute inset-0 bg-gradient-to-b from-violet-500/10 to-transparent" />
      <h2 className="relative text-[clamp(2rem,5vw,3.6rem)] font-extrabold leading-[1.05] tracking-[-0.035em]">Ready to do more with AI?</h2>
      <p className="relative mx-auto mt-4 max-w-md text-fg-soft">Create your free workspace in under a minute. No card required.</p>
      <div className="relative mt-8 flex flex-wrap justify-center gap-3"><Button asChild size="lg" variant="light"><Link to="/register">Get Started Free <ArrowRight className="h-4 w-4" /></Link></Button><Button asChild size="lg" variant="secondary"><Link to="/login">Sign in</Link></Button></div>
    </Reveal>
  </section>
);

const Footer = () => (
  <footer className="mt-32 border-t border-line bg-ink-900/60">
    <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
      <div className="grid gap-10 md:grid-cols-6">
        <div className="md:col-span-2"><Logo /><p className="mt-4 max-w-xs text-sm leading-6 text-fg-mute">Create. Collaborate. Do more with AI. Thirteen tools and one workspace.</p>
          <div className="mt-5 flex gap-2">{[['X', '/'], ['GitHub', 'https://github.com/zobbygit'], ['LinkedIn', 'https://www.linkedin.com/in/zohaib-aslam-245a40253']].map(([n, h]) => <a key={n} href={h} target="_blank" rel="noopener noreferrer" aria-label={n} className="grid h-9 min-w-9 place-items-center rounded-xl border border-white/10 px-2.5 text-[11px] font-bold text-fg-mute transition hover:border-white/25 hover:text-white">{n}</a>)}</div></div>
        {([['Product', [['Features', 'features'], ['Workspace', 'features'], ['How it works', 'tools']]], ['AI Tools', [['AI Writer', 'tools'], ['PDF AI', 'tools'], ['Text → Image', 'tools'], ['Data Analyzer', 'tools']]], ['Pricing', [['Free plan', 'pricing'], ['Pro plan', 'pricing']]], ['Support', [['FAQ', 'faq'], ['Testimonials', 'testimonials']]]] as [string, string[][]][]).map(([h, links]) => (
          <div key={h}><p className="label">{h}</p><ul className="mt-4 space-y-2.5">{links.map(([l, id]) => <li key={l}><button onClick={() => scrollTo(id)} className="text-sm text-fg-soft transition hover:text-white">{l}</button></li>)}</ul></div>
        ))}
      </div>
      <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-line pt-6 text-xs text-fg-faint sm:flex-row">
        <p>© {new Date().getFullYear()} Nexora. All rights reserved.</p>

        <div className="flex items-center gap-5">
          
          {/* <span>Legal</span><span>Privacy</span><span>Terms</span> */}
          <LegalModals/>
        
        <Link to="/admin/login" className="opacity-290 transition hover:opacity-100">Admin Login</Link></div>

      </div>
    </div>
  </footer>
);

export default function Landing() {
  const [demo, setDemo] = useState(false);
  const nav = useNavigate();
  return (
    <div className="relative">
      <Navbar />
      <main>
        <Hero onDemo={() => setDemo(true)} /><Providers /><Features /><Tools /><HowItWorks /><FreeVsPro /><Showcase /><Collaboration /><ArtifactMgmt /><ProviderEcosystem /><ProductPreview /><Plans /><Testimonials /><Faq /><FinalCta />
      </main>
      <Footer />
      <Modal open={demo} onClose={() => setDemo(false)} title="Nexora in 30 seconds" description="Pick a tool, run it, keep the result in your workspace." width="max-w-2xl">
        <div className="relative overflow-hidden rounded-2xl border border-line"><MiniDashboard /></div>
        <div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={() => setDemo(false)}>Close</Button><Button onClick={() => nav('/register')}>Try it free</Button></div>
      </Modal>
    </div>
  );
}
