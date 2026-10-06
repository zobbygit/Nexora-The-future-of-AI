import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Clock, FileUp, Pencil, Save, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Badge, Skeleton, Tabs } from '@/components/ui/primitives';
import { CreditPill, ErrorBanner, GeneratingCard, ProLock } from '@/components/shared/Bits';
import { Markdown } from '@/components/shared/Markdown';
import { useBootstrap } from '@/hooks/useApp';
import type { RunState } from '@/hooks/useToolRun';
import { api } from '@/lib/api';
import { TOOL_BY_ID } from '@/lib/tools';
import type { Artifact, Generation } from '@/lib/types';
import { cn, errorMessage, formatBytes, timeAgo } from '@/lib/utils';
import { toast } from '@/store/ui';
import { ArtifactViewer } from './Viewers';
import { ResultActions } from './ResultActions';

export const ToolShell = ({ id, children }: { id: string; children: ReactNode }) => {
  const meta = TOOL_BY_ID[id];
  const { data } = useBootstrap();
  const info = data?.tools.find((t) => t.id === id);
  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex flex-wrap items-center gap-4">
        <span className={cn('grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br shadow-lg [&_svg]:h-6 [&_svg]:w-6', meta.tile)} style={{ boxShadow: `0 14px 40px -14px ${meta.glow}` }}><meta.icon /></span>
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2.5"><h1 className="text-[clamp(1.6rem,3vw,2.2rem)] font-extrabold tracking-[-0.03em]">{meta.name}</h1><Badge tone={meta.free ? 'ok' : 'pro'}>{meta.free ? 'FREE' : 'PRO'}</Badge></div><p className="mt-1 text-[15px] text-fg-mute">{meta.blurb}</p></div>
        {info && <CreditPill cost={info.credits} />}
      </motion.div>
      {!data ? <Skeleton className="h-96" /> : info?.enabled === false ? <div className="rounded-3xl border border-dashed border-white/10 p-12 text-center text-fg-mute">This tool is temporarily unavailable.</div> : info?.locked ? (
        <div className="relative">
          <div className="pointer-events-none select-none opacity-60 blur-[3px]" aria-hidden {...({ inert: '' } as object)}>{children}</div>
          <div className="absolute inset-0 z-10 flex items-start justify-center bg-ink/55 px-4 pt-16 backdrop-blur-[2px] sm:pt-24"><ProLock tool={meta.name} /></div>
        </div>
      ) : children}
    </div>
  );
};

export const RecentRuns = ({ tool, onPick }: { tool: string; onPick?: (g: Generation) => void }) => {
  const { data } = useQuery({ queryKey: ['history', 'tool', tool], queryFn: async () => (await api.get('/history', { params: { tool, status: 'completed', limit: 5 } })).data.items as Generation[], staleTime: 10_000 });
  if (!data?.length) return null;
  return (
    <div className="mt-6"><p className="label mb-3 flex items-center gap-2"><Clock className="h-3.5 w-3.5" />Recent</p>
      <ul className="space-y-1.5">{data.map((g) => <li key={g.id}>
        {g.artifactId ? <Link to={`/app/workspace?artifact=${g.artifactId}`} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white/[0.02] px-3.5 py-2.5 text-sm transition hover:border-white/20 hover:bg-white/[0.05]"><span className="truncate font-semibold">{g.title}</span><span className="shrink-0 text-xs text-fg-faint">{timeAgo(g.createdAt)}</span></Link>
          : <button onClick={() => onPick?.(g)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-2.5 text-left text-sm"><span className="truncate font-semibold">{g.title}</span><span className="text-xs text-fg-faint">{timeAgo(g.createdAt)}</span></button>}</li>)}</ul>
    </div>
  );
};

/** Editable text result: preview/edit toggle with save for owners and editors. */
export const TextResult = ({ artifact, onChange, minH = 360 }: { artifact: Artifact; onChange: (a: Artifact) => void; minH?: number }) => {
  const qc = useQueryClient();
  const [mode, setMode] = useState<'preview' | 'edit'>('preview');
  const [draft, setDraft] = useState(artifact.content || '');
  const [saving, setSaving] = useState(false);
  useEffect(() => { setDraft(artifact.content || ''); setMode('preview'); }, [artifact.id, artifact.content]);
  const canEdit = artifact.role !== 'viewer';
  const dirty = draft !== (artifact.content || '');
  const save = async () => {
    setSaving(true);
    try { const { data } = await api.patch(`/artifacts/${artifact.id}`, { content: draft }); onChange(data.artifact); qc.invalidateQueries({ queryKey: ['artifacts'] }); toast.success('Saved'); setMode('preview'); }
    catch (e) { toast.error('Could not save', errorMessage(e)); } finally { setSaving(false); }
  };
  const words = (draft.match(/\S+/g) || []).length;
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <Tabs tabs={[{ id: 'preview', label: 'Preview' }, ...(canEdit ? [{ id: 'edit', label: 'Edit' }] : [])]} value={mode} onChange={(v) => setMode(v as any)} />
        <span className="text-xs text-fg-mute">{words.toLocaleString()} words</span>
      </div>
      {mode === 'edit' ? (
        <div><textarea value={draft} onChange={(e) => setDraft(e.target.value)} style={{ minHeight: minH }} className="field w-full resize-y font-mono text-[13px] leading-6" aria-label="Edit content" />
          <div className="mt-3 flex justify-end gap-2"><Button variant="ghost" onClick={() => { setDraft(artifact.content || ''); setMode('preview'); }}><X className="h-4 w-4" />Discard</Button><Button onClick={save} loading={saving} disabled={!dirty}><Save className="h-4 w-4" />Save changes</Button></div></div>
      ) : <div style={{ minHeight: minH / 2 }} className="rounded-2xl border border-line bg-ink-900/60 p-5 sm:p-7"><Markdown>{artifact.content || ''}</Markdown></div>}
    </div>
  );
};
void Pencil;

export const OutputPanel = ({ state, error, status, retry, artifact, onArtifact, onDeleted, idle, label, children, editable = true, pro }: {
  state: RunState; error: { message: string; code?: string } | null; status: string; retry: () => void; artifact: Artifact | null; onArtifact: (a: Artifact) => void; onDeleted: () => void; idle: ReactNode; label?: string; children?: ReactNode; editable?: boolean; pro?: boolean;
}) => (
  <div className="space-y-4">
    {state === 'error' && error && <ErrorBanner code={error.code} message={error.message} onRetry={error.code === 'INSUFFICIENT_CREDITS' || error.code === 'PRO_REQUIRED' ? undefined : retry} pro={error.code === 'PRO_REQUIRED' || error.code === 'INSUFFICIENT_CREDITS' || pro} />}
    {state === 'running' && <GeneratingCard label={label} status={status} />}
    {state === 'idle' && idle}
    {state === 'error' && !artifact && <div className="hidden" />}
    {state === 'done' && artifact && (
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <div className="surface p-5 sm:p-6">
          {children ?? (editable && ['text', 'code', 'resume', 'response'].includes(artifact.kind) && artifact.kind !== 'resume' ? <TextResult artifact={artifact} onChange={onArtifact} /> : <ArtifactViewer artifact={artifact} />)}
        </div>
        <ResultActions artifact={artifact} onChange={onArtifact} onDeleted={onDeleted} />
      </motion.div>
    )}
  </div>
);

export const Placeholder = ({ icon, title, body }: { icon: ReactNode; title: string; body: string }) => (
  <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.015] p-8 text-center">
    <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-violet-300">{icon}</div>
    <p className="font-bold">{title}</p><p className="mt-1.5 max-w-xs text-sm text-fg-mute">{body}</p>
  </div>
);

export const FileDrop = ({ accept, file, onFile, hint, preview }: { accept: string; file: File | null; onFile: (f: File | null) => void; hint: string; preview?: 'image' | 'video' | 'audio' }) => {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [url, setUrl] = useState('');
  useEffect(() => { if (!file || !preview) { setUrl(''); return; } const u = URL.createObjectURL(file); setUrl(u); return () => URL.revokeObjectURL(u); }, [file, preview]);
  return (
    <div>
      <input ref={input} type="file" accept={accept} className="sr-only" onChange={(e) => onFile(e.target.files?.[0] || null)} aria-label="Choose file" />
      {file ? (
        <div className="rounded-2xl border border-line bg-white/[0.03] p-3">
          {url && preview === 'image' && <img src={url} alt="Selected" className="mb-3 max-h-64 w-full rounded-xl object-contain" />}
          {url && preview === 'video' && <video src={url} controls className="mb-3 max-h-64 w-full rounded-xl bg-black" />}
          {url && preview === 'audio' && <audio src={url} controls className="mb-3 w-full" />}
          <div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{file.name}</p><p className="text-xs text-fg-mute">{formatBytes(file.size)}</p></div><div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => input.current?.click()}>Replace</Button><Button size="icon" variant="ghost" onClick={() => onFile(null)} aria-label="Remove file"><X className="h-4 w-4" /></Button></div></div>
        </div>
      ) : (
        <button type="button" onClick={() => input.current?.click()} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
          className={cn('flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition', over ? 'border-violet-400 bg-violet-500/10' : 'border-white/12 hover:border-violet-400/50 hover:bg-white/[0.03]')}>
          <motion.span animate={over ? { y: -6, scale: 1.1 } : { y: 0, scale: 1 }} className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-violet-500/15 text-violet-300"><FileUp className="h-5 w-5" /></motion.span>
          <p className="font-semibold">Drop a file or <span className="text-violet-300">browse</span></p><p className="mt-1 text-xs text-fg-mute">{hint}</p>
        </button>
      )}
    </div>
  );
};
