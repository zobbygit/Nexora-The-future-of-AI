import { AnimatePresence, motion } from 'framer-motion';
import { Maximize2, Pause, Play, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import { Markdown } from '@/components/shared/Markdown';
import { fileUrl } from '@/lib/api';
import type { Artifact } from '@/lib/types';
import { cn } from '@/lib/utils';

export const AudioPlayer = ({ src }: { src: string }) => {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [d, setD] = useState(0);
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-line bg-white/[0.03] p-4">
      <audio ref={ref} src={src} preload="metadata" onLoadedMetadata={(e) => setD(e.currentTarget.duration)} onTimeUpdate={(e) => setT(e.currentTarget.currentTime)} onEnded={() => setPlaying(false)} />
      <button onClick={() => { const a = ref.current; if (!a) return; if (playing) a.pause(); else void a.play(); setPlaying(!playing); }} aria-label={playing ? 'Pause' : 'Play'} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-b from-violet-500 to-violet-600 shadow-glow transition active:scale-95">{playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="ml-0.5 h-5 w-5 fill-current" />}</button>
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex h-8 items-end gap-[3px]" aria-hidden>{Array.from({ length: 42 }, (_, i) => { const h = 22 + ((i * 37) % 70); const on = d ? i / 42 < t / d : false; return <span key={i} className={cn('w-full rounded-full transition-colors', on ? 'bg-violet-400' : 'bg-white/15')} style={{ height: `${h}%` }} />; })}</div>
        <input type="range" min={0} max={d || 1} step={0.05} value={t} onChange={(e) => { if (ref.current) ref.current.currentTime = Number(e.target.value); setT(Number(e.target.value)); }} aria-label="Seek" className="h-1 w-full cursor-pointer accent-violet-500" />
        <div className="mt-1 flex justify-between font-mono text-[11px] text-fg-mute"><span>{fmt(t)}</span><span>{fmt(d)}</span></div>
      </div>
    </div>
  );
};

export const ImageViewer = ({ src, alt, checker }: { src: string; alt: string; checker?: boolean }) => {
  const [full, setFull] = useState(false);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && setFull(false); if (full) window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [full]);
  return (
    <>
      <div className={cn('group relative overflow-hidden rounded-2xl border border-line', checker && 'bg-[length:20px_20px] bg-[image:conic-gradient(#1a1f36_25%,#10131f_0_50%,#1a1f36_0_75%,#10131f_0)]')}>
        <img src={src} alt={alt} className="mx-auto max-h-[560px] w-full object-contain" loading="lazy" />
        <button onClick={() => setFull(true)} aria-label="View full size" className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-xl bg-black/60 opacity-0 backdrop-blur transition group-hover:opacity-100 focus:opacity-100"><Maximize2 className="h-4 w-4" /></button>
      </div>
      <AnimatePresence>{full && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[150] grid place-items-center bg-black/90 p-6" onClick={() => setFull(false)}><button className="absolute right-5 top-5 grid h-11 w-11 place-items-center rounded-full bg-white/10" aria-label="Close"><X /></button><img src={src} alt={alt} className="max-h-full max-w-full rounded-xl object-contain" /></motion.div>}</AnimatePresence>
    </>
  );
};

/** Draggable before/after comparison. */
export const BeforeAfter = ({ before, after, transparent }: { before: string; after: string; transparent?: boolean }) => {
  const [pos, setPos] = useState(50);
  const box = useRef<HTMLDivElement>(null);
  const move = (clientX: number) => { const r = box.current?.getBoundingClientRect(); if (r) setPos(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100))); };
  return (
    <div ref={box} className={cn('relative select-none overflow-hidden rounded-2xl border border-line touch-none', transparent && 'bg-[length:20px_20px] bg-[image:conic-gradient(#1a1f36_25%,#10131f_0_50%,#1a1f36_0_75%,#10131f_0)]')}
      onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); move(e.clientX); }} onPointerMove={(e) => e.buttons && move(e.clientX)}>
      <img src={after} alt="After" className="pointer-events-none mx-auto max-h-[520px] w-full object-contain" />
      <div className="pointer-events-none absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}><img src={before} alt="Before" className="mx-auto max-h-[520px] w-full bg-ink-800 object-contain" /></div>
      <div className="pointer-events-none absolute inset-y-0" style={{ left: `${pos}%` }}><div className="absolute inset-y-0 -translate-x-1/2 w-0.5 bg-white shadow-[0_0_12px_rgba(255,255,255,0.8)]" /><div className="absolute top-1/2 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-ink/80 text-xs font-bold backdrop-blur">⇆</div></div>
      <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-bold backdrop-blur">Before</span><span className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-bold backdrop-blur">After</span>
      <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} aria-label="Comparison position" className="sr-only" />
    </div>
  );
};

const tip = { contentStyle: { background: '#131728', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, fontSize: 12 }, cursor: { fill: 'rgba(255,255,255,.04)' } };

export interface DataResult {
  insights: string; rows: number; columns: number; duplicates: number; headers: string[]; preview: Record<string, unknown>[];
  columnStats: { name: string; type: string; nulls: number; unique: number; min?: number; max?: number; mean?: number; median?: number; std?: number; outliers?: number; top?: { value: string; count: number }[] }[];
  correlations: { a: string; b: string; r: number }[];
  charts: { id: string; type: 'histogram' | 'bar' | 'scatter'; title: string; caption: string; x: string; y?: string; data: Record<string, number | string>[] }[];
}

export const DataView = ({ data }: { data: DataResult }) => (
  <div className="space-y-6">
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[['Rows', data.rows], ['Columns', data.columns], ['Duplicates', data.duplicates], ['Missing cells', data.columnStats.reduce((a, c) => a + c.nulls, 0)]].map(([l, v]) => <div key={l as string} className="rounded-2xl border border-line bg-white/[0.03] p-4"><p className="text-2xl font-extrabold">{(v as number).toLocaleString()}</p><p className="text-xs text-fg-mute">{l}</p></div>)}
    </div>
    {data.insights && <div className="rounded-2xl border border-violet-400/20 bg-violet-500/[0.05] p-5"><p className="label mb-2 text-violet-300">AI insights</p><Markdown>{data.insights}</Markdown></div>}
    {data.charts.length > 0 && <div className="grid gap-4 lg:grid-cols-2">{data.charts.map((c) => (
      <div key={c.id} className="rounded-2xl border border-line bg-white/[0.03] p-4">
        <p className="font-bold">{c.title}</p><p className="mb-3 mt-0.5 text-xs text-fg-mute">{c.caption}</p>
        <div className="h-56"><ResponsiveContainer width="100%" height="100%">
          {c.type === 'scatter' ? (
            <ScatterChart margin={{ left: -10, right: 8, top: 4 }}><CartesianGrid stroke="rgba(255,255,255,.06)" /><XAxis type="number" dataKey="x" name={c.x} tick={{ fill: '#8b90a8', fontSize: 11 }} stroke="rgba(255,255,255,.1)" /><YAxis type="number" dataKey="y" name={c.y} tick={{ fill: '#8b90a8', fontSize: 11 }} stroke="rgba(255,255,255,.1)" /><RTooltip {...tip} /><Scatter data={c.data as any} fill="#8b5cf6" fillOpacity={0.7} /></ScatterChart>
          ) : (
            <BarChart data={c.data} margin={{ left: -10, right: 8, top: 4 }}><CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} /><XAxis dataKey="label" tick={{ fill: '#8b90a8', fontSize: 10 }} stroke="rgba(255,255,255,.1)" interval="preserveStartEnd" /><YAxis tick={{ fill: '#8b90a8', fontSize: 11 }} stroke="rgba(255,255,255,.1)" allowDecimals={false} /><RTooltip {...tip} /><Bar dataKey="count" fill="#8b5cf6" radius={[6, 6, 0, 0]} /></BarChart>
          )}
        </ResponsiveContainer></div>
      </div>))}</div>}
    <div><p className="label mb-3">Column statistics</p><div className="overflow-x-auto rounded-2xl border border-line"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-white/[0.04] text-[11px] uppercase tracking-wider text-fg-mute"><tr>{['Column', 'Type', 'Missing', 'Unique', 'Min', 'Median', 'Mean', 'Max', 'Outliers'].map((h) => <th key={h} className="px-3 py-2.5 font-semibold">{h}</th>)}</tr></thead>
      <tbody>{data.columnStats.map((c) => <tr key={c.name} className="border-t border-line"><td className="px-3 py-2 font-semibold">{c.name}</td><td className="px-3 py-2 text-fg-mute">{c.type}</td><td className="px-3 py-2">{c.nulls}</td><td className="px-3 py-2">{c.unique}</td><td className="px-3 py-2">{c.min ?? '—'}</td><td className="px-3 py-2">{c.median ?? '—'}</td><td className="px-3 py-2">{c.mean ?? '—'}</td><td className="px-3 py-2">{c.max ?? '—'}</td><td className="px-3 py-2">{c.outliers ?? '—'}</td></tr>)}</tbody></table></div></div>
    {data.correlations.length > 0 && <div><p className="label mb-3">Strongest correlations</p><div className="flex flex-wrap gap-2">{data.correlations.map((c) => <span key={c.a + c.b} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold">{c.a} ↔ {c.b} <b className={c.r > 0 ? 'text-ok' : 'text-bad'}>{c.r}</b></span>)}</div></div>}
    <div><p className="label mb-3">Preview (first {data.preview.length} rows)</p><div className="max-h-72 overflow-auto rounded-2xl border border-line"><table className="w-full min-w-[520px] text-left text-xs"><thead className="sticky top-0 bg-ink-700 text-fg-mute"><tr>{data.headers.map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr></thead><tbody>{data.preview.map((r, i) => <tr key={i} className="border-t border-line">{data.headers.map((h) => <td key={h} className="whitespace-nowrap px-3 py-1.5">{String(r[h] ?? '')}</td>)}</tr>)}</tbody></table></div></div>
  </div>
);

export const ArtifactViewer = ({ artifact }: { artifact: Artifact }) => {
  const url = fileUrl(artifact.url);
  switch (artifact.kind) {
    case 'image': return <ImageViewer src={url} alt={artifact.title} checker={artifact.meta?.operation === 'background-removed'} />;
    case 'audio': return <AudioPlayer src={url} />;
    case 'video': return <video src={url} controls className="max-h-[520px] w-full rounded-2xl border border-line bg-black" />;
    case 'pdf': return <iframe src={url} title={artifact.title} className="h-[640px] w-full rounded-2xl border border-line bg-white" />;
    case 'data': { try { return <DataView data={JSON.parse(artifact.content || '{}')} />; } catch { return <p className="text-sm text-fg-mute">This analysis could not be displayed.</p>; } }
    case 'resume': {
      const style = (artifact.meta?.style as string) || 'modern';
      const skin = style === 'classic' ? 'font-serif [&_.prose-nx_h1]:!text-center [&_.prose-nx_h2]:!border-[#222] [&_.prose-nx_h2]:!tracking-[0.18em]' : style === 'minimal' ? '[&_.prose-nx]:!text-[13.5px] [&_.prose-nx_h2]:!border-transparent [&_.prose-nx_h2]:!text-[#7c5cff] [&_.prose-nx_p]:!my-2' : '[&_.prose-nx_h1]:!border-l-4 [&_.prose-nx_h1]:!border-[#7c5cff] [&_.prose-nx_h1]:!pl-3 [&_.prose-nx_h2]:!border-[#c9c0ff] [&_.prose-nx_h2]:!text-[#4d3bd6]';
      return <div data-resume-style={style} className={cn('mx-auto max-w-[780px] rounded-lg bg-white p-8 text-[#1a1d2b] shadow-2xl sm:p-12 [&_.prose-nx]:text-[#333a4d] [&_.prose-nx_*]:!text-inherit [&_.prose-nx_h1]:!text-[#0b0d17] [&_.prose-nx_h2]:!border-b [&_.prose-nx_h2]:!pb-1 [&_.prose-nx_h2]:!text-[15px] [&_.prose-nx_h2]:!uppercase [&_.prose-nx_a]:!text-[#4d3bd6]', skin)}><Markdown>{artifact.content || ''}</Markdown></div>;
    }
    case 'file': return <p className="text-sm text-fg-mute">Preview is not available for this file type. Use Download.</p>;
    default: return artifact.content ? <Markdown>{artifact.content}</Markdown> : <p className="text-sm text-fg-mute">Nothing to preview.</p>;
  }
};
