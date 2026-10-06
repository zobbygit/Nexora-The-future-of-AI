import { motion } from 'framer-motion';
import { Lock, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/shared/Bits';
import { Tilt } from '@/components/ui/Tilt';
import { EmptyState, Skeleton } from '@/components/ui/primitives';
import { useBootstrap } from '@/hooks/useApp';
import { CATEGORIES, TOOL_META, toolPath } from '@/lib/tools';
import { cn } from '@/lib/utils';

export default function ToolsGrid() {
  const { data } = useBootstrap();
  const [cat, setCat] = useState('All tools');
  const [q, setQ] = useState('');
  const list = useMemo(() => TOOL_META.filter((t) => (cat === 'All tools' || t.category === cat) && (t.name + t.blurb).toLowerCase().includes(q.toLowerCase())), [cat, q]);
  return (
    <div>
      <PageHeader title="AI Tools" subtitle={`${TOOL_META.length} powerful tools to help you create, analyze, and innovate.`} />
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72"><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-mute" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tools…" aria-label="Search tools" className="h-11 w-full rounded-full border border-white/[0.08] bg-white/[0.04] pl-11 pr-4 text-sm outline-none transition focus:border-violet-500/60 focus:ring-4 focus:ring-violet-500/15" /></div>
        <div className="flex flex-wrap gap-2">{['All tools', ...CATEGORIES].map((c) => <button key={c} onClick={() => setCat(c)} aria-pressed={cat === c} className={cn('rounded-full border px-4 py-2 text-[13px] font-semibold transition', cat === c ? 'border-violet-400/60 bg-violet-500/25 text-white shadow-glow' : 'border-white/10 bg-white/[0.03] text-fg-mute hover:border-white/25 hover:text-fg')}>{c}</button>)}</div>
      </div>
      {!data ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-40" />)}</div> : list.length === 0 ? <EmptyState icon={<Search className="h-6 w-6" />} title="No tools match" body="Try a different search or category." /> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {list.map((t, i) => { const info = data.tools.find((x) => x.id === t.id); return (
            <motion.div key={t.id} className="h-full" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Link to={toolPath(t.id)} className="block h-full focus:outline-none" aria-label={`${t.name}${info?.locked ? ' (Pro)' : ''}`}>
                <Tilt className="surface relative h-full p-5" max={9}>
                  <span className={cn('absolute right-4 top-4 rounded-full border px-2 py-0.5 text-[10px] font-bold', t.free ? 'border-ok/30 text-ok' : 'border-amber-400/50 text-amber-300')}>{t.free ? 'Free' : 'Pro'}</span>
                  <span className={cn('grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br shadow-lg', t.tile)} style={{ boxShadow: `0 12px 30px -12px ${t.glow}` }}><t.icon className="h-5 w-5" /></span>
                  <h3 className="mt-4 font-bold">{t.name}</h3><p className="mt-1 text-[13px] leading-5 text-fg-mute">{t.blurb}</p>
                  <div className="mt-4 flex items-center justify-between text-xs text-fg-faint"><span>{info?.credits ?? '–'} credits</span>{info?.locked && <span className="flex items-center gap-1 text-amber-300"><Lock className="h-3 w-3" />Upgrade</span>}</div>
                </Tilt>
              </Link>
            </motion.div>); })}
        </div>)}
    </div>
  );
}
