import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { BarChart3, BookOpenText, CheckCircle2, FileSearch, FileText, ListChecks, Loader2, MessageSquare, Microscope, Send, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ConfirmModal, Field, Input, Skeleton } from '@/components/ui/primitives';
import { Markdown } from '@/components/shared/Markdown';
import { DataView, type DataResult } from '@/components/tools/Viewers';
import { FileDrop, OutputPanel, Placeholder, RecentRuns, ToolShell } from '@/components/tools/ToolShell';
import { ResultActions } from '@/components/tools/ResultActions';
import { useBootstrap } from '@/hooks/useApp';
import { useToolRun } from '@/hooks/useToolRun';
import { api, fileUrl } from '@/lib/api';
import type { Artifact, RunResult } from '@/lib/types';
import { cn, errorMessage } from '@/lib/utils';
import { toast } from '@/store/ui';
import { useResult } from './TextTools';

interface Doc { id: string; name: string; pages: number; chunkCount: number; status: 'processing' | 'ready' | 'failed'; artifactId?: string; createdAt: string; shared?: boolean }
interface Citation { page: number; section: string; snippet: string; score: number }
interface Turn { role: 'user' | 'assistant'; content: string; citations?: Citation[]; artifact?: Artifact | null; mode?: string }

export function PdfAI() {
  const qc = useQueryClient();
  const { data: boot } = useBootstrap();
  const credits = boot?.tools.find((t) => t.id === 'pdf')?.credits ?? 0;
  const { data: docs, isLoading } = useQuery({ queryKey: ['pdf-docs'], queryFn: async () => (await api.get('/tools/pdf/documents')).data.documents as Doc[] });
  const [active, setActive] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [turns, setTurns] = useState<Record<string, Turn[]>>({});
  const [q, setQ] = useState('');
  const [del, setDel] = useState<Doc | null>(null);
  const [showPdf, setShowPdf] = useState(false);
  const run = useToolRun();
  const end = useRef<HTMLDivElement>(null);
  const doc = docs?.find((d) => d.id === active);
  const art = useQuery({ queryKey: ['artifact', doc?.artifactId], enabled: showPdf && !!doc?.artifactId, queryFn: async () => (await api.get(`/artifacts/${doc!.artifactId}`)).data.artifact as Artifact });
  useEffect(() => { if (!active && docs?.length) setActive(docs[0].id); }, [docs, active]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [turns, run.running]);

  const upload = useMutation({
    mutationFn: async (f: File) => { const fd = new FormData(); fd.append('file', f); return (await api.post('/tools/pdf/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } })).data.document as Doc; },
    onSuccess: (d) => { qc.invalidateQueries({ queryKey: ['pdf-docs'] }); qc.invalidateQueries({ queryKey: ['artifacts'] }); setActive(d.id); setFile(null); toast.success('Document ready', `${d.pages} pages indexed.`); },
    onError: (e) => toast.error('Could not process PDF', errorMessage(e)),
  });
  const remove = useMutation({ mutationFn: async (id: string) => api.delete(`/tools/pdf/documents/${id}`), onSuccess: (_r, id) => { setDel(null); if (active === id) setActive(''); qc.invalidateQueries({ queryKey: ['pdf-docs'] }); qc.invalidateQueries({ queryKey: ['artifacts'] }); toast.success('Document deleted'); }, onError: (e) => toast.error('Could not delete', errorMessage(e)) });

  const ask = async (mode: 'ask' | 'summarize' | 'extract' | 'analyze', question = '') => {
    if (!doc) return;
    if (mode === 'ask' && question.trim().length < 2) return;
    const label = mode === 'ask' ? question : { summarize: 'Summarize this document', extract: 'Extract key information', analyze: 'Analyze this document' }[mode];
    const hist = (turns[doc.id] || []).slice(-6).map((t) => ({ role: t.role, content: t.content.slice(0, 3000) }));
    setTurns((t) => ({ ...t, [doc.id]: [...(t[doc.id] || []), { role: 'user', content: label }] }));
    setQ('');
    const res = (await run.run('/tools/pdf/ask', { documentId: doc.id, mode, question, history: mode === 'ask' ? hist : [] })) as RunResult | null;
    if (res) setTurns((t) => ({ ...t, [doc.id]: [...(t[doc.id] || []), { role: 'assistant', content: res.generation.output.answer, citations: res.generation.output.citations, artifact: res.artifact, mode }] }));
    else setTurns((t) => ({ ...t, [doc.id]: (t[doc.id] || []).slice(0, -1) }));
  };

  const list = doc ? turns[doc.id] || [] : [];
  return (
    <ToolShell id="pdf">
      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <div className="surface space-y-4 p-5">
            <FileDrop accept="application/pdf,.pdf" file={file} onFile={setFile} hint="PDF with selectable text · up to 15 MB" />
            {file && <Button className="w-full" onClick={() => upload.mutate(file)} loading={upload.isPending}>{upload.isPending ? 'Reading & indexing…' : 'Upload & process'}</Button>}
          </div>
          <div className="surface p-4">
            <p className="label mb-3 px-1">Your documents</p>
            {isLoading ? <div className="space-y-2"><Skeleton className="h-14" /><Skeleton className="h-14" /></div> : !docs?.length ? <p className="px-2 py-6 text-center text-sm text-fg-mute">No documents yet.</p> :
              <ul className="space-y-1.5">{docs.map((d) => (
                <li key={d.id}><div className={cn('group flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition', active === d.id ? 'border-violet-400/40 bg-violet-500/10' : 'border-transparent hover:bg-white/[0.04]')}>
                  <button onClick={() => setActive(d.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-400/15 text-orange-300"><FileText className="h-5 w-5" /></span><span className="min-w-0"><span className="block truncate text-sm font-semibold">{d.name}{d.shared && <span className="ml-2 rounded-full bg-sky2/15 px-1.5 py-px text-[9px] font-bold text-sky2">SHARED</span>}</span><span className="flex items-center gap-1.5 text-xs text-fg-mute">{d.status === 'ready' ? <><CheckCircle2 className="h-3 w-3 text-ok" />{d.pages} pages · {d.chunkCount} sections</> : d.status === 'processing' ? <><Loader2 className="h-3 w-3 animate-spin" />Processing</> : 'Failed'}</span></span></button>
                  <button onClick={() => setDel(d)} disabled={d.shared} aria-label={`Delete ${d.name}`} className="grid h-8 w-8 place-items-center rounded-lg text-fg-faint opacity-0 transition hover:bg-bad/10 hover:text-bad group-hover:opacity-100 focus:opacity-100"><Trash2 className="h-4 w-4" /></button>
                </div></li>))}</ul>}
          </div>
          <RecentRuns tool="pdf" />
        </div>

        <div className="surface flex min-h-[620px] flex-col overflow-hidden p-0">
          {!doc ? <div className="grid flex-1 place-items-center p-6"><Placeholder icon={<FileSearch className="h-6 w-6" />} title="Upload a PDF to begin" body="Ask questions, summarize, extract facts or analyze. Answers cite the page they came from." /></div> : (<>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
              <div className="min-w-0"><p className="truncate font-bold">{doc.name}</p><p className="text-xs text-fg-mute">{doc.pages} pages · {credits} credits per request</p></div>
              <div className="flex flex-wrap gap-2"><Button size="sm" variant={showPdf ? 'primary' : 'secondary'} onClick={() => setShowPdf((v) => !v)} aria-pressed={showPdf}>{showPdf ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}{showPdf ? 'Hide PDF' : 'Preview PDF'}</Button>{([['summarize', 'Summarize', BookOpenText], ['extract', 'Extract', ListChecks], ['analyze', 'Analyze', Microscope]] as const).map(([m, l, I]) => <Button key={m} size="sm" variant="secondary" disabled={run.running || doc.status !== 'ready'} onClick={() => ask(m)}><I className="h-3.5 w-3.5" />{l}</Button>)}</div>
            </div>
            {showPdf && <div className="border-b border-line bg-ink-900/60 p-3">{art.isLoading ? <Skeleton className="h-72" /> : art.data?.url ? <iframe src={fileUrl(art.data.url)} title={`Preview of ${doc.name}`} className="h-[420px] w-full rounded-xl border border-line bg-white" /> : <p className="py-10 text-center text-sm text-fg-mute">Preview unavailable.</p>}{art.data && <div className="mt-3"><ResultActions artifact={art.data} compact onDeleted={() => undefined} /></div>}</div>}
            <div className="flex-1 space-y-5 overflow-y-auto p-5" aria-live="polite">
              {list.length === 0 && !run.running && <div className="grid h-full place-items-center"><div className="text-center"><MessageSquare className="mx-auto mb-3 h-7 w-7 text-violet-300" /><p className="font-bold">Chat with your document</p><p className="mt-1 text-sm text-fg-mute">Try: “What are the key deadlines?”</p></div></div>}
              {list.map((t, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn('flex', t.role === 'user' && 'justify-end')}>
                  {t.role === 'user' ? <div className="max-w-[85%] rounded-2xl rounded-br-md bg-violet-600 px-4 py-2.5 text-sm">{t.content}</div> : (
                    <div className="max-w-full space-y-3"><div className="rounded-2xl rounded-bl-md border border-line bg-white/[0.03] px-5 py-4"><Markdown>{t.content}</Markdown></div>
                      {!!t.citations?.length && <div className="flex flex-wrap gap-1.5">{[...new Map(t.citations.map((c) => [c.page, c])).values()].slice(0, 6).map((c) => <span key={c.page} title={c.snippet} className="cursor-help rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-fg-soft">Page {c.page}</span>)}</div>}
                      {t.artifact && <ResultActions artifact={t.artifact} compact onDeleted={() => undefined} />}</div>)}
                </motion.div>))}
              {run.running && <div className="flex items-center gap-3 text-sm text-fg-mute"><Loader2 className="h-4 w-4 animate-spin text-violet-300" />{run.status || 'Working'}…</div>}
              {run.state === 'error' && run.error && <div className="rounded-2xl border border-bad/25 bg-bad/[0.07] px-4 py-3 text-sm">{run.error.message}</div>}
              <div ref={end} />
            </div>
            <form onSubmit={(e) => { e.preventDefault(); void ask('ask', q); }} className="flex gap-2 border-t border-line p-4">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={doc.status === 'ready' ? 'Ask anything about this document…' : 'Document is not ready'} disabled={doc.status !== 'ready' || run.running} aria-label="Question" maxLength={2000} />
              <Button type="submit" disabled={!q.trim() || run.running || doc.status !== 'ready'} aria-label="Send"><Send className="h-4 w-4" /></Button>
            </form></>)}
        </div>
      </div>
      <ConfirmModal open={!!del} onClose={() => setDel(null)} onConfirm={() => del && remove.mutate(del.id)} loading={remove.isPending} danger title="Delete document?" body={`“${del?.name}” and its searchable index will be permanently removed.`} confirmLabel="Delete" />
    </ToolShell>
  );
}

export function DataAnalyzer() {
  const r = useResult('data-analyzer');
  const [file, setFile] = useState<File | null>(null);
  const [question, setQuestion] = useState('');
  const [preview, setPreview] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    let live = true;
    file.slice(0, 40000).text().then((t) => {
      if (!live) return;
      if (/\.json$/i.test(file.name)) { try { const j = JSON.parse(t.length >= 39999 ? '[]' : t); const a = Array.isArray(j) ? j : j.data || []; const h = Object.keys(a[0] || {}); setPreview({ headers: h, rows: a.slice(0, 6).map((x: any) => h.map((k) => String(x[k] ?? ''))) }); } catch { setPreview(null); } return; }
      const sep = file.name.endsWith('.tsv') ? '\t' : ',';
      const lines = t.split(/\r?\n/).filter(Boolean).slice(0, 7).map((l) => l.split(sep));
      setPreview({ headers: lines[0] || [], rows: lines.slice(1) });
    });
    return () => { live = false; };
  }, [file]);
  const fd = () => { const f = new FormData(); if (question) f.append('question', question); f.append('file', file!); return f; };
  const data = r.artifact?.kind === 'data' ? (r.result?.generation.output as DataResult) : null;
  return (
    <ToolShell id="data-analyzer">
      <div className="grid gap-6 xl:grid-cols-[400px_1fr]">
        <div className="space-y-4">
          <div className="surface space-y-5 p-5 sm:p-6">
            <FileDrop accept=".csv,.tsv,.json,text/csv,application/json" file={file} onFile={(f) => { setFile(f); r.reset(); }} hint="CSV, TSV or JSON (array of objects) · up to 10 MB" />
            {preview && <div className="overflow-x-auto rounded-xl border border-line"><table className="w-full text-left text-[11px]"><thead className="bg-white/[0.04] text-fg-mute"><tr>{preview.headers.slice(0, 6).map((h, i) => <th key={i} className="whitespace-nowrap px-2.5 py-1.5">{h}</th>)}</tr></thead><tbody>{preview.rows.map((row, i) => <tr key={i} className="border-t border-line">{row.slice(0, 6).map((c, j) => <td key={j} className="max-w-[120px] truncate px-2.5 py-1.5">{c}</td>)}</tr>)}</tbody></table></div>}
            <Field label="Question (optional)"><Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Which region is growing fastest?" maxLength={500} /></Field>
            <Button size="lg" className="w-full" disabled={!file} onClick={() => file && r.run('/tools/data-analyzer', fd())} loading={r.running}><BarChart3 className="h-4 w-4" />Analyze · {r.credits} credits</Button>
          </div>
          <RecentRuns tool="data-analyzer" />
        </div>
        <OutputPanel {...r} artifact={r.artifact} onArtifact={r.setArtifact} onDeleted={() => { r.setArtifact(null); r.reset(); }} label="Profiling dataset" idle={<Placeholder icon={<BarChart3 className="h-6 w-6" />} title="Analysis appears here" body="Statistics, distributions and correlations are computed from your data first. AI then explains what they mean." />}>
          {data && <DataView data={data} />}
        </OutputPanel>
      </div>
    </ToolShell>
  );
}
