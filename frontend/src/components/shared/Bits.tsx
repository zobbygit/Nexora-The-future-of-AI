import { motion } from 'framer-motion';
import { Coins, Lock, Sparkles } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

export const PageHeader = ({ title, subtitle, actions, eyebrow }: { title: string; subtitle?: string; actions?: ReactNode; eyebrow?: string }) => (
  <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
    <div className="min-w-0">{eyebrow && <p className="label mb-2 text-violet-300">{eyebrow}</p>}<h1 className="text-[clamp(1.7rem,3.4vw,2.4rem)] font-extrabold leading-tight tracking-[-0.03em]">{title}</h1>{subtitle && <p className="mt-1.5 max-w-2xl text-[15px] text-fg-mute">{subtitle}</p>}</div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

export const Card = ({ className, children, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn('surface p-5 sm:p-6', className)} {...p}>{children}</div>;
export const SectionTitle = ({ children, action }: { children: ReactNode; action?: ReactNode }) => <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-[17px] font-bold">{children}</h2>{action}</div>;

export const CreditPill = ({ cost, free }: { cost: number; free?: boolean }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-bold text-fg-soft"><Coins className="h-3.5 w-3.5 text-amber-300" />{cost} credits{free !== undefined && <Badge tone={free ? 'ok' : 'pro'} className="ml-1">{free ? 'FREE' : 'PRO'}</Badge>}</span>
);

export const ProLock = ({ tool }: { tool: string }) => (
  <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md rounded-3xl border border-amber-400/30 bg-ink-800/95 p-8 text-center shadow-2xl backdrop-blur-xl">
    <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-amber-400/40 bg-amber-400/10 text-amber-300"><Lock className="h-6 w-6" /></div>
    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-300">Pro feature</p>
    <h2 className="mt-2 text-2xl font-extrabold tracking-tight">Upgrade to Nexora Pro</h2>
    <p className="mt-1 text-lg font-bold text-fg-soft">₹400<span className="text-sm font-medium text-fg-mute">/month</span></p>
    <p className="mx-auto mt-3 max-w-xs text-sm text-fg-mute">Unlock {tool} and all 13 tools, plus a monthly pool of Pro credits.</p>
    <Button asChild size="lg" className="mt-6 w-full"><Link to="/app/billing"><Sparkles className="h-4 w-4" />Upgrade to Pro</Link></Button>
  </motion.div>
);

const STAGES = ['Preparing', 'Sending request', 'Generating', 'Processing', 'Finalizing'];
export const GeneratingCard = ({ label = 'Generating', status }: { label?: string; status?: string }) => {
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI((x) => Math.min(x + 1, STAGES.length - 1)), 1400); return () => clearInterval(t); }, []);
  return (
    <div className="relative flex min-h-[260px] flex-col items-center justify-center overflow-hidden rounded-3xl border border-violet-400/20 bg-violet-500/[0.05] p-8 text-center" role="status" aria-live="polite">
      <div className="absolute inset-0 overflow-hidden"><motion.div className="absolute -inset-x-1/2 top-0 h-full bg-gradient-to-r from-transparent via-violet-400/10 to-transparent" animate={{ x: ['-30%', '60%'] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }} /></div>
      <div className="relative flex gap-1.5">{[0, 1, 2, 3, 4].map((k) => <motion.span key={k} className="w-1.5 rounded-full bg-violet-400" animate={{ height: [10, 34, 10] }} transition={{ duration: 1, repeat: Infinity, delay: k * 0.12 }} />)}</div>
      <p className="relative mt-5 text-base font-bold">{status && status !== 'Starting' ? status : label}…</p>
      <ol className="relative mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] font-semibold" aria-label="Progress">
        {STAGES.map((s, k) => <li key={s} className={k < i ? 'text-ok' : k === i ? 'text-violet-300' : 'text-fg-faint'}>{k < i ? '✓ ' : ''}{s}</li>)}
      </ol>
    </div>
  );
};

export const ErrorBanner = ({ message, onRetry, pro, code }: { message: string; onRetry?: () => void; pro?: boolean; code?: string }) => {
  const generation = !['INSUFFICIENT_CREDITS', 'PRO_REQUIRED', 'VALIDATION_ERROR'].includes(code || '');
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-bad/25 bg-bad/[0.07] px-5 py-4" role="alert">
      <p className="font-bold">{generation ? 'Something went wrong.' : 'Heads up'}</p>
      <p className="mt-1 text-sm text-fg-soft">{generation ? "We couldn't complete this generation." : message}</p>
      {generation && <p className="mt-1 text-xs text-fg-mute">{message.replace(/\s*Your credits were not charged\.?/i, '')} Your credits were not charged.</p>}
      <div className="mt-3 flex gap-2">{pro && <Button asChild size="sm"><Link to="/app/billing">Upgrade</Link></Button>}{onRetry && <Button size="sm" variant="secondary" onClick={onRetry}>Try Again</Button>}</div>
    </motion.div>
  );
};
