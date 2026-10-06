import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogoMark } from '@/components/brand/Logo';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { TOOL_META } from '@/lib/tools';
import { cn, errorMessage } from '@/lib/utils';
import { useAuth } from '@/store/auth';
import { toast } from '@/store/ui';

const STEPS = [
  { key: 'useCases', q: 'What do you want to use Nexora for?', hint: 'Pick as many as you like.', tags: ['Writing', 'Coding', 'Research', 'Documents', 'Images', 'Audio', 'Productivity', 'Automation'], hue: '#6d47f0' },
  { key: 'building', q: 'What are you building?', hint: 'This helps us set up the right starting point.', tags: ['Projects', 'Content', 'School', 'Business', 'Personal Work', 'Research', 'Other'], hue: '#3b6bff' },
  { key: 'goals', q: 'What should Nexora help you do more?', hint: 'Choose your main goals.', tags: ['Create faster', 'Learn faster', 'Automate work', 'Organize everything', 'Analyze information', 'Build better'], hue: '#14b8d4' },
] as const;
type Key = (typeof STEPS)[number]['key'];

const TOOL_HINTS: Record<string, string[]> = { Writing: ['writer', 'resume'], Coding: ['code'], Research: ['pdf', 'agent'], Documents: ['pdf', 'data-analyzer'], Images: ['text-to-image', 'image-enhancer'], Audio: ['tts', 'stt'], Productivity: ['agent', 'writer'], Automation: ['agent'] };

const list = (a: string[]) => (a.length <= 1 ? a[0] || '' : a.length === 2 ? `${a[0]} and ${a[1]}` : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);

export default function Onboarding() {
  const nav = useNavigate();
  const { user, setUser } = useAuth();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [sel, setSel] = useState<Record<Key, string[]>>({ useCases: [], building: [], goals: [] });
  const [saving, setSaving] = useState(false);
  const done = step === STEPS.length;
  const current = STEPS[Math.min(step, STEPS.length - 1)];

  const go = (n: number) => { setDir(n > step ? 1 : -1); setStep(n); };
  const toggle = (k: Key, t: string) => setSel((s) => ({ ...s, [k]: s[k].includes(t) ? s[k].filter((x) => x !== t) : [...s[k], t] }));

  const finish = async () => {
    setSaving(true);
    try { const { data } = await api.post('/onboarding', sel); setUser(data.user); nav('/app', { replace: true }); }
    catch (e) { toast.error('Could not save your setup', errorMessage(e)); setSaving(false); }
  };

  const recs = useMemo(() => {
    const ids = [...new Set(sel.useCases.flatMap((u) => TOOL_HINTS[u] || []))].slice(0, 3);
    return (ids.length ? ids : ['writer', 'pdf', 'code']).map((id) => TOOL_META.find((t) => t.id === id)!).filter(Boolean);
  }, [sel.useCases]);

  const first = user?.name?.split(' ')[0] || 'there';
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden px-5 py-8 sm:px-10">
      <motion.div aria-hidden className="pointer-events-none absolute left-1/2 top-[38%] h-[720px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[110px]"
        animate={{ background: `radial-gradient(closest-side, ${done ? '#6d47f0' : current.hue}66, transparent)` }} transition={{ duration: 1.2 }} />
      <header className="relative z-10 flex items-center justify-between">
        <LogoMark className="h-9 w-9" />
        {!done && <div className="flex items-center gap-2" aria-label={`Step ${step + 1} of 3`}>{STEPS.map((s, i) => (
          <div key={s.key} className="h-[3px] w-12 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-sky2" initial={false} animate={{ width: i < step ? '100%' : i === step ? '55%' : '0%' }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} /></div>
        ))}</div>}
        <span className="w-9" />
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center py-10">
        <AnimatePresence mode="wait" custom={dir}>
          {!done ? (
            <motion.section key={step} custom={dir} initial={{ opacity: 0, x: dir * 60, filter: 'blur(8px)' }} animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, x: dir * -60, filter: 'blur(8px)' }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
              <p className="label text-violet-300">{step === 0 ? `Welcome, ${first}` : `Step ${step + 1} of 3`}</p>
              <h1 className="mt-3 text-[clamp(2rem,5.4vw,3.4rem)] font-extrabold leading-[1.06] tracking-[-0.035em]">{current.q}</h1>
              <p className="mt-3 text-fg-mute">{current.hint}</p>
              <div className="mt-10 flex flex-wrap gap-3" role="group" aria-label={current.q}>
                {current.tags.map((t, i) => {
                  const on = sel[current.key].includes(t);
                  return (
                    <motion.button key={t} type="button" aria-pressed={on} onClick={() => toggle(current.key, t)}
                      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 + i * 0.045 }} whileHover={{ y: -3 }} whileTap={{ scale: 0.94 }}
                      className={cn('relative flex items-center gap-2 overflow-hidden rounded-full border px-5 py-3 text-[15px] font-semibold transition-colors', on ? 'border-violet-400/70 bg-violet-500/20 text-white shadow-glow' : 'border-white/10 bg-white/[0.03] text-fg-soft hover:border-white/25 hover:text-white')}>
                      <AnimatePresence initial={false}>{on && <motion.span initial={{ width: 0, opacity: 0, scale: 0.4 }} animate={{ width: 18, opacity: 1, scale: 1 }} exit={{ width: 0, opacity: 0, scale: 0.4 }} className="grid h-[18px] place-items-center overflow-hidden rounded-full bg-violet-500"><Check className="h-3 w-3" strokeWidth={3.5} /></motion.span>}</AnimatePresence>
                      {t}
                    </motion.button>
                  );
                })}
              </div>
            </motion.section>
          ) : (
            <motion.section key="done" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.15 }} className="mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-sky2 shadow-glow"><Check className="h-7 w-7" strokeWidth={3} /></motion.div>
              <h1 className="text-[clamp(2.2rem,6vw,3.8rem)] font-extrabold leading-[1.04] tracking-[-0.035em]">Your workspace <span className="text-gradient">is ready.</span></h1>
              <p className="mt-5 max-w-xl text-[17px] leading-8 text-fg-soft">
                Focused on <b className="text-white">{list(sel.useCases.map((s) => s.toLowerCase()))}</b>, for <b className="text-white">{list(sel.building.map((s) => s.toLowerCase()))}</b> — so you can <b className="text-white">{list(sel.goals.map((s) => s.toLowerCase()))}</b>.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                {recs.map((t, i) => (
                  <motion.div key={t.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.1 }} className="glass flex items-center gap-3 rounded-2xl py-2.5 pl-2.5 pr-5">
                    <span className={cn('grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br', t.tile)}><t.icon className="h-4 w-4" /></span><span className="text-sm font-bold">{t.name}</span>
                  </motion.div>
                ))}
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      <footer className="relative z-10 mx-auto flex w-full max-w-3xl items-center justify-between">
        <Button variant="ghost" onClick={() => go(step - 1)} disabled={step === 0 || saving} className={cn(step === 0 && 'invisible')}><ArrowLeft className="h-4 w-4" />Back</Button>
        {done ? <Button size="lg" onClick={finish} loading={saving}>Enter Nexora <ArrowRight className="h-4 w-4" /></Button>
          : <Button size="lg" disabled={sel[current.key].length === 0} onClick={() => go(step + 1)}>{step === STEPS.length - 1 ? 'Finish setup' : 'Continue'} <ArrowRight className="h-4 w-4" /></Button>}
      </footer>
    </div>
  );
}
