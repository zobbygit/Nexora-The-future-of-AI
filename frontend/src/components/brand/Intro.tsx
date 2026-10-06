import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { useEffect, useState } from 'react';

export const INTRO_KEY = 'nexora:intro:v1';
const STATUS = ['Waking up Nexora', 'Connecting intelligence', 'Preparing the experience', 'Almost ready', 'Welcome to Nexora'];

/**
 * First-visit cinematic intro: light gathers, the mark draws itself, a progress line fills,
 * then two dark curtains part on a seam of light to reveal the site underneath.
 */
export const Intro = ({ onDone }: { onDone: () => void }) => {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<'load' | 'open' | 'gone'>('load');
  const [canSkip, setCanSkip] = useState(false);
  const progress = useMotionValue(0);
  const pct = useTransform(progress, (v) => Math.round(v));
  const [display, setDisplay] = useState(0);
  const [statusIdx, setStatusIdx] = useState(0);

  useEffect(() => {
    document.documentElement.style.overflow = 'hidden';
    const unsub = pct.on('change', (v) => { setDisplay(v); setStatusIdx(v >= 100 ? 4 : v >= 75 ? 3 : v >= 50 ? 2 : v >= 25 ? 1 : 0); });
    const controls = animate(progress, 100, { duration: reduce ? 0.5 : 3.4, ease: [0.45, 0.05, 0.25, 1], onComplete: () => setTimeout(() => setPhase('open'), reduce ? 50 : 350) });
    const skipTimer = setTimeout(() => setCanSkip(true), 1200);
    return () => { controls.stop(); unsub(); clearTimeout(skipTimer); document.documentElement.style.overflow = ''; };
  }, [progress, pct, reduce]);

  useEffect(() => {
    if (phase !== 'open') return;
    const t = setTimeout(() => { setPhase('gone'); document.documentElement.style.overflow = ''; try { localStorage.setItem(INTRO_KEY, '1'); } catch { /* private mode */ } onDone(); }, reduce ? 250 : 1500);
    return () => clearTimeout(t);
  }, [phase, onDone, reduce]);

  const skip = () => { progress.stop(); progress.set(100); setPhase('open'); };
  if (phase === 'gone') return null;
  const opening = phase === 'open';
  const panel = { duration: reduce ? 0.2 : 1.15, ease: [0.76, 0, 0.18, 1] as const };

  return (
    <div className="fixed inset-0 z-[200]" role="status" aria-label="Loading Nexora">
      {/* Curtains */}
      <motion.div className="absolute inset-y-0 left-0 w-1/2 bg-ink" animate={{ x: opening ? '-102%' : 0 }} transition={panel}>
        <div className="aurora" />
      </motion.div>
      <motion.div className="absolute inset-y-0 right-0 w-1/2 bg-ink" animate={{ x: opening ? '102%' : 0 }} transition={panel} />

      {/* Seam of light where the curtains meet */}
      <motion.div aria-hidden className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-violet-300 to-transparent"
        initial={{ opacity: 0, scaleY: 0 }} animate={{ opacity: opening ? [1, 1, 0] : 0.9, scaleY: 1, width: opening ? [1, 80, 0] : 1 }} transition={{ duration: opening ? 1.1 : 1.4, delay: opening ? 0 : 0.2 }}
        style={{ boxShadow: '0 0 60px 8px rgba(139,92,246,0.7)', filter: opening ? 'blur(6px)' : 'none' }} />

      <AnimatePresence>
        {!opening && (
          <motion.div className="absolute inset-0 flex flex-col items-center justify-center" exit={{ opacity: 0, scale: 1.06, filter: 'blur(8px)' }} transition={{ duration: 0.6 }}>
            <motion.div aria-hidden className="absolute h-[520px] w-[520px] rounded-full" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 2, ease: 'easeOut' }}
              style={{ background: 'radial-gradient(closest-side, rgba(99,72,230,0.45), rgba(40,60,200,0.12) 55%, transparent)' }} />
            <motion.svg viewBox="0 0 48 48" className="relative h-24 w-24" fill="none" initial="hide" animate="show">
              <defs><linearGradient id="in-g" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse"><stop stopColor="#c4b5fd" /><stop offset=".55" stopColor="#7c5cff" /><stop offset="1" stopColor="#4f8bff" /></linearGradient></defs>
              <motion.rect x="3" y="3" width="42" height="42" rx="13" stroke="url(#in-g)" strokeWidth="1.4" variants={{ hide: { pathLength: 0, opacity: 0 }, show: { pathLength: 1, opacity: 1 } }} transition={{ duration: reduce ? 0.2 : 1.5, ease: 'easeInOut' }} />
              <motion.path d="M15 34V14l18 20V14" stroke="url(#in-g)" strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" variants={{ hide: { pathLength: 0 }, show: { pathLength: 1 } }} transition={{ duration: reduce ? 0.2 : 1.4, delay: reduce ? 0 : 0.7, ease: 'easeInOut' }} />
            </motion.svg>
            <div className="relative mt-7 flex overflow-hidden text-4xl font-extrabold tracking-tight" aria-hidden>
              {'Nexora'.split('').map((c, i) => (
                <motion.span key={i} initial={{ y: '110%', opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: reduce ? 0 : 1.3 + i * 0.06, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>{c}</motion.span>
              ))}
            </div>
            <motion.p className="relative mt-3 h-5 text-sm text-fg-mute" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.8 }}>
              <AnimatePresence mode="wait"><motion.span key={statusIdx} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }} className="inline-block">{STATUS[statusIdx]}</motion.span></AnimatePresence>
            </motion.p>
            <motion.div className="relative mt-9 w-64" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6 }}>
              <div className="h-[2px] overflow-hidden rounded-full bg-white/10"><motion.div className="h-full rounded-full bg-gradient-to-r from-violet-400 via-violet-500 to-sky2" style={{ width: `${display}%`, boxShadow: '0 0 16px rgba(139,92,246,0.9)' }} /></div>
              <div className="mt-2.5 flex justify-between font-mono text-[11px] text-fg-faint"><span>AI is loading</span><span>{String(display).padStart(3, '0')}%</span></div>
            </motion.div>
            {canSkip && <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={skip} className="absolute bottom-8 rounded-full px-4 py-2 text-xs font-semibold text-fg-faint transition hover:bg-white/5 hover:text-fg">Skip intro</motion.button>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
