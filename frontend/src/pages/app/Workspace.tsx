import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, AudioLines, Clapperboard, Code2, File, FileText, FolderKanban, Heart, Image as ImageIcon, LayoutGrid, List, Pencil, Search, Table2, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, Input, Pagination, Select, Skeleton, Tabs } from '@/components/ui/primitives';
import { PageHeader } from '@/components/shared/Bits';
import { ResultActions } from '@/components/tools/ResultActions';
import { TextResult } from '@/components/tools/ToolShell';
import { ArtifactViewer } from '@/components/tools/Viewers';
import { api, fileUrl } from '@/lib/api';
import { toolName } from '@/lib/tools';
import type { Artifact } from '@/lib/types';
import { cn, errorMessage, formatBytes, timeAgo } from '@/lib/utils';
import { toast } from '@/store/ui';

const KIND_ICON: Record<string, typeof File> = { text: FileText, code: Code2, resume: FileText, response: FileText, image: ImageIcon, audio: AudioLines, video: Clapperboard, pdf: FileText, data: Table2, file: File };
const KIND_TINT: Record<string, string> = { text: 'text-violet-300 bg-violet-500/15', code: 'text-teal-300 bg-teal-400/15', resume: 'text-rose-300 bg-rose-400/15', response: 'text-violet-300 bg-violet-500/15', image: 'text-pink-300 bg-pink-400/15', audio: 'text-sky-300 bg-sky-400/15', video: 'text-indigo-300 bg-indigo-400/15', pdf: 'text-orange-300 bg-orange-400/15', data: 'text-fuchsia-300 bg-fuchsia-400/15', file: 'text-fg-soft bg-white/10' };
const KINDS = ['all', 'text', 'code', 'resume', 'response', 'image', 'audio', 'video', 'pdf', 'data'];

export const ArtifactDetail = ({ id, onClose, inline }: { id: string | any; onClose: () => void; inline?: boolean }) => {
  const qc = useQueryClient();
  const actualId = typeof id === 'object' && id !== null ? id.id : id;
  const { data, isLoading, error } = useQuery({
    queryKey: ['artifact', actualId],
    queryFn: async () => (await api.get(`/artifacts/${actualId}`)).data.artifact as Artifact,
    enabled: !!actualId,
  });
  const [title, setTitle] = useState('');
  const [editing, setEditing] = useState(false);
  useEffect(() => { if (data) setTitle(data.title); }, [data]);
  const setA = (a: Artifact) => {
    qc.setQueryData(['artifact', actualId], a);
    qc.invalidateQueries({ queryKey: ['artifacts'] });
  };
  const saveTitle = async () => {
    if (!data || !title.trim() || title === data.title) { setEditing(false); return; }
    try {
      const r = await api.patch(`/artifacts/${actualId}`, { title });
      setA(r.data.artifact);
      toast.success('Renamed');
    } catch (e) {
      toast.error('Could not rename', errorMessage(e));
      setTitle(data.title);
    }
    setEditing(false);
  };
  return (
    <div className="min-w-0">
      <div className="mb-5 flex items-start gap-2 sm:items-center sm:gap-3">
        <Button variant="ghost" size="sm" onClick={onClose} className="shrink-0">
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">{inline ? 'Back' : 'Close'}</span>
        </Button>
        {data && (
          <div className="min-w-0 flex-1">
            {editing ? (
              <Input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void saveTitle();
                  if (e.key === 'Escape') { setTitle(data.title); setEditing(false); }
                }}
                className="!py-1.5 text-lg font-bold"
                aria-label="Title"
              />
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="truncate text-lg font-extrabold tracking-tight sm:text-xl">{data.title}</h2>
                {data.role !== 'viewer' && (
                  <button onClick={() => setEditing(true)} aria-label="Rename" className="shrink-0 text-fg-faint transition hover:text-fg">
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
            <p className="mt-0.5 truncate text-xs text-fg-mute">
              {data.tool ? toolName(data.tool) + ' · ' : ''}{data.kind} · {formatBytes(data.size)} · updated {timeAgo(data.updatedAt)}{data.role !== 'owner' && ` · ${data.role}`}
            </p>
          </div>
        )}
      </div>
      {isLoading ? <Skeleton className="h-96" /> : error || !data ? <ErrorState message={errorMessage(error, 'This item is no longer available.')} /> : (
        <div className="min-w-0 space-y-4">
          <div className="surface min-w-0 p-4 sm:p-6">
            {['text', 'code', 'response'].includes(data.kind) ? <TextResult artifact={data} onChange={setA} /> : <ArtifactViewer artifact={data} />}
          </div>
          <ResultActions artifact={data} onChange={setA} onDeleted={onClose} />
        </div>
      )}
    </div>
  );
};

export default function Workspace() {
  const [sp, setSp] = useSearchParams();
  const qc = useQueryClient();
  const open = sp.get('artifact');
  const [scope, setScope] = useState(sp.get('scope') || 'mine');
  const [kind, setKind] = useState('all');
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('recent');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [uploading, setUploading] = useState(false);
  const fileIn = useRef<HTMLInputElement>(null);
  useEffect(() => { const t = setTimeout(() => { setDq(q); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['artifacts', scope, kind, dq, page, sort],
    queryFn: async () => (await api.get('/artifacts', { params: { scope: scope === 'favorites' ? 'mine' : scope, favorite: scope === 'favorites' ? 'true' : undefined, kind, q: dq || undefined, page, sort, limit: 18 } })).data as { items: Artifact[]; total: number; pages: number },
    placeholderData: (p) => p,
  });
  const upload = async (f: File) => {
    const fd = new FormData(); fd.append('file', f); setUploading(true);
    try { await api.post('/artifacts/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } }); toast.success('Uploaded', f.name); qc.invalidateQueries({ queryKey: ['artifacts'] }); } catch (e) { toast.error('Upload failed', errorMessage(e)); } finally { setUploading(false); }
  };
  const tabs = [{ id: 'mine', label: 'My Artifacts' }, { id: 'files', label: 'My Files' }, { id: 'recent', label: 'Recent' }, { id: 'favorites', label: 'Favorites' }, { id: 'shared', label: 'Shared with me' }];
  const close = () => { const n = new URLSearchParams(sp); n.delete('artifact'); setSp(n, { replace: true }); };

  if (open) return <ArtifactDetail id={open} onClose={close} inline />;

  return (
    <div className="min-w-0 overflow-x-hidden">
      <PageHeader
        title="Workspace"
        subtitle="Everything you have created and uploaded — previewed right here."
        actions={
          <>
            <input
              ref={fileIn}
              type="file"
              className="sr-only"
              accept="image/*,audio/*,video/mp4,video/webm,application/pdf"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }}
              aria-label="Upload file"
            />
            <Button onClick={() => fileIn.current?.click()} loading={uploading} className="w-full sm:w-auto">
              <Upload className="h-4 w-4" />Upload file
            </Button>
          </>
        }
      />

      {/* Tabs — horizontally scrollable on mobile, no negative-margin bleed */}
      <div className="mb-5 max-w-full overflow-x-auto">
        <div className="min-w-max">
          <Tabs tabs={tabs} value={scope} onChange={(v) => { setScope(v); setPage(1); }} />
        </div>
      </div>

      {/* Filter row — stacked on mobile, single row on sm+ */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-mute" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title…" className="pl-10" aria-label="Search workspace" />
          {q && (
            <button onClick={() => setQ('')} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-mute hover:text-fg">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Select
            value={kind}
            onChange={(e) => { setKind(e.target.value); setPage(1); }}
            className="!w-auto min-w-0 flex-1 capitalize sm:flex-none"
            aria-label="Category"
          >
            {KINDS.map((k) => (
              <option key={k} value={k} style={{ backgroundColor: '#1c1c1e', color: '#ffffff' }}>
                {k === 'all' ? 'All categories' : k}
              </option>
            ))}
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value)} className="!w-auto min-w-0 flex-1 sm:flex-none" aria-label="Sort">
            <option value="recent" style={{ backgroundColor: '#1c1c1e', color: '#ffffff' }}>Most recent</option>
            <option value="name" style={{ backgroundColor: '#1c1c1e', color: '#ffffff' }}>Name</option>
          </Select>
          <div className="ml-auto flex shrink-0 rounded-xl border border-line p-1 sm:ml-0">
            {([['grid', LayoutGrid], ['list', List]] as const).map(([v, I]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                aria-label={`${v} view`}
                aria-pressed={view === v}
                className={cn('grid h-8 w-8 place-items-center rounded-lg transition', view === v ? 'bg-violet-600 text-white' : 'text-fg-mute hover:text-fg')}
              >
                <I className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {error ? <ErrorState message={errorMessage(error)} onRetry={() => refetch()} /> : isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-44" />)}
        </div>
      ) : !data?.items.length ? (
        <EmptyState
          icon={<FolderKanban className="h-6 w-6" />}
          title={dq ? 'No matches' : scope === 'shared' ? 'Nothing shared with you yet' : scope === 'favorites' ? 'No favorites yet' : 'Your workspace is empty'}
          body={dq ? 'Try a different search.' : 'Generated results and uploaded files will appear here.'}
          action={!dq && <Button onClick={() => fileIn.current?.click()}><Upload className="h-4 w-4" />Upload a file</Button>}
        />
      ) : (
        <div className={cn('min-w-0 transition-opacity', isFetching && 'opacity-60')}>
          <motion.div
            layout
            className={view === 'grid' ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3' : 'space-y-2'}
          >
            <AnimatePresence mode="popLayout">
              {data.items.map((a) => {
                const I = KIND_ICON[a.kind] || File;
                const isImg = a.kind === 'image' && a.url;
                return (
                  <motion.button
                    layout
                    key={a.id}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    whileHover={{ y: -4 }}
                    onClick={() => { const n = new URLSearchParams(sp); n.set('artifact', a.id); if (scope === 'shared') n.set('scope', 'shared'); setSp(n); }}
                    className={cn(
                      'surface group w-full min-w-0 text-left transition-colors hover:border-violet-400/30',
                      view === 'grid' ? 'flex flex-col overflow-hidden' : 'flex items-center gap-3 p-3 sm:gap-4',
                    )}
                  >
                    <div className={cn('relative grid shrink-0 place-items-center overflow-hidden', view === 'grid' ? 'h-36 w-full' : 'h-14 w-14 rounded-xl', KIND_TINT[a.kind])}>
                      {isImg && typeof a.url === 'string' ? (
                        <img src={fileUrl(a.url)} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                      ) : (
                        <I className={view === 'grid' ? 'h-10 w-10' : 'h-6 w-6'} />
                      )}
                      {a.favorite && <Heart className="absolute right-2.5 top-2.5 h-4 w-4 fill-rose-400 text-rose-400 drop-shadow" />}
                    </div>
                    <div className={cn('min-w-0 overflow-hidden', view === 'grid' ? 'p-4' : 'flex-1')}>
                      <p className="truncate font-bold">{a.title}</p>
                      <p className="mt-0.5 truncate text-xs capitalize text-fg-mute">
                        {a.kind}{a.tool ? ` · ${toolName(a.tool)}` : ''} · {timeAgo(a.updatedAt)}{a.role !== 'owner' && ` · ${a.role}`}
                      </p>
                    </div>
                    {view === 'list' && <span className="hidden shrink-0 pr-2 text-xs text-fg-faint md:block">{formatBytes(a.size)}</span>}
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </motion.div>
          <Pagination page={page} pages={data.pages} onChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
        </div>
      )}
    </div>
  );
}