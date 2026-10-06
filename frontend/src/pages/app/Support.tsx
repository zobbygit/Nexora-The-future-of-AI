import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, CheckCheck, LifeBuoy, MessageCircle, Paperclip, Plus, Send, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Badge, EmptyState, ErrorState, Field, Input, Modal, Select, Skeleton, Tabs, Textarea } from '@/components/ui/primitives';
import { PageHeader } from '@/components/shared/Bits';
import { api, fileUrl } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { cn, errorMessage, formatDate, timeAgo } from '@/lib/utils';
import { useAuth } from '@/store/auth';
import { toast } from '@/store/ui';

interface Msg { id: string; sender: 'user' | 'admin'; text: string; readAt?: string; createdAt: string }
export const STATUS_TONE: Record<string, 'info' | 'warn' | 'ok' | 'bad' | 'neutral'> = { open: 'info', in_progress: 'warn', resolved: 'ok', reopened: 'bad', closed: 'neutral' };
export const STATUS_LABEL: Record<string, string> = { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved', reopened: 'Reopened', closed: 'Closed' };

const Chat = () => {
  const qc = useQueryClient();
  const user = useAuth((s) => s.user);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['chat'], queryFn: async () => (await api.get('/support/chat')).data as { messages: Msg[]; unread: number; adminOnline: boolean; enabled: boolean } });
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [adminOnline, setAdminOnline] = useState(false);
  const [typing, setTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const tTimer = useRef<ReturnType<typeof setTimeout>>();
  const lastTyping = useRef(0);

  useEffect(() => { if (data) { setMsgs(data.messages); setAdminOnline(data.adminOnline); } }, [data]);
  useEffect(() => {
    const s = getSocket('user');
    const onMsg = (m: Msg & { userId: string }) => { setMsgs((x) => (x.some((y) => y.id === m.id) ? x : [...x, m])); if (m.sender === 'admin') { s.emit('chat:read'); setTyping(false); } };
    const onTyping = (p: { from: string; typing: boolean }) => { if (p.from !== 'admin') return; setTyping(p.typing); clearTimeout(tTimer.current); if (p.typing) tTimer.current = setTimeout(() => setTyping(false), 4000); };
    const onRead = () => setMsgs((x) => x.map((m) => (m.sender === 'user' && !m.readAt ? { ...m, readAt: new Date().toISOString() } : m)));
    const onPresence = (p: { online: boolean }) => setAdminOnline(p.online);
    s.on('chat:message', onMsg); s.on('chat:typing', onTyping); s.on('chat:read', onRead); s.on('presence:admin', onPresence);
    s.emit('chat:read'); qc.invalidateQueries({ queryKey: ['bootstrap'] });
    return () => { s.off('chat:message', onMsg); s.off('chat:typing', onTyping); s.off('chat:read', onRead); s.off('presence:admin', onPresence); };
  }, [qc]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs, typing]);

  const send = () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    getSocket('user').timeout(8000).emit('chat:send', { text: t }, (err: unknown, res: { ok: boolean; error?: string }) => {
      setSending(false);
      if (err || !res?.ok) return toast.error('Message not sent', res?.error || 'Check your connection and try again.');
      setText('');
    });
  };
  if (error) return <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />;
  return (
    <div className="surface flex h-[calc(100vh-290px)] min-h-[480px] flex-col overflow-hidden p-0">
      <div className="flex items-center gap-3 border-b border-line px-5 py-3.5"><span className="relative grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-sky2 font-bold">N<span className={cn('absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-ink-800', adminOnline ? 'bg-ok' : 'bg-fg-faint')} /></span><div><p className="font-bold">Nexora Support</p><p className="text-xs text-fg-mute">{adminOnline ? 'Online now' : 'Offline — we will reply as soon as we are back'}</p></div></div>
      <div className="flex-1 space-y-3 overflow-y-auto p-5" aria-live="polite">
        {isLoading ? <Skeleton className="h-16 w-2/3" /> : msgs.length === 0 ? <div className="grid h-full place-items-center text-center"><div><MessageCircle className="mx-auto mb-3 h-7 w-7 text-violet-300" /><p className="font-bold">Start a conversation</p><p className="mt-1 text-sm text-fg-mute">Ask a question and our team will reply here.</p></div></div> :
          msgs.map((m, i) => { const mine = m.sender === 'user'; const showTime = i === 0 || new Date(m.createdAt).getTime() - new Date(msgs[i - 1].createdAt).getTime() > 600000; return (
            <div key={m.id}>{showTime && <p className="my-3 text-center text-[11px] text-fg-faint">{formatDate(m.createdAt)}</p>}
              <motion.div initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} className={cn('flex', mine && 'justify-end')}>
                <div className={cn('max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-6', mine ? 'rounded-br-md bg-violet-600' : 'rounded-bl-md border border-line bg-white/[0.05]')}><p className="whitespace-pre-wrap break-words">{m.text}</p>
                  <p className={cn('mt-1 flex items-center justify-end gap-1 text-[10px]', mine ? 'text-white/60' : 'text-fg-faint')}>{timeAgo(m.createdAt)}{mine && (m.readAt ? <CheckCheck className="h-3 w-3 text-sky-300" aria-label="Read" /> : <Check className="h-3 w-3" aria-label="Sent" />)}</p></div></motion.div></div>); })}
        <AnimatePresence>{typing && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex"><div className="flex gap-1 rounded-2xl rounded-bl-md border border-line bg-white/[0.05] px-4 py-3" aria-label="Support is typing">{[0, 1, 2].map((i) => <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-fg-mute" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.12 }} />)}</div></motion.div>}</AnimatePresence>
        <div ref={end} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2 border-t border-line p-4">
        <Input value={text} maxLength={2000} disabled={data?.enabled === false} placeholder={data?.enabled === false ? 'Live chat is currently unavailable' : `Message support as ${user?.name?.split(' ')[0] || 'you'}…`} aria-label="Message"
          onChange={(e) => { setText(e.target.value); const n = Date.now(); if (n - lastTyping.current > 2000) { lastTyping.current = n; getSocket('user').emit('chat:typing', { typing: true }); } }} />
        <Button type="submit" disabled={!text.trim()} loading={sending} aria-label="Send message"><Send className="h-4 w-4" /></Button>
      </form>
    </div>
  );
};

interface Report { id: string; category: string; subject: string; description: string; status: string; attachments: { name: string; url: string }[]; responses: { by: string; text: string; at: string }[]; history: { status: string; by: string; note: string; at: string }[]; createdAt: string; updatedAt: string }
const CATS = [['bug', 'Bug'], ['billing', 'Billing'], ['account', 'Account'], ['ai_quality', 'AI quality'], ['feature_request', 'Feature request'], ['other', 'Other']];

const Reports = () => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['reports'], queryFn: async () => (await api.get('/support/reports')).data.items as Report[] });
  const current = data?.find((r) => r.id === sel);
  return (
    <div>
      <div className="mb-5 flex justify-end"><Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />New report</Button></div>
      {error ? <ErrorState message={errorMessage(error)} onRetry={() => refetch()} /> : isLoading ? <Skeleton className="h-40" /> : !data?.length ? <EmptyState icon={<LifeBuoy className="h-6 w-6" />} title="No reports yet" body="Found a problem or need help? Create a report and we will get back to you." action={<Button onClick={() => setOpen(true)}>Create report</Button>} /> : (
        <div className="space-y-2.5">{data.map((r) => (
          <button key={r.id} onClick={() => setSel(r.id)} className="surface flex w-full items-center gap-4 p-4 text-left transition hover:border-violet-400/30"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-violet-300"><LifeBuoy className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1"><span className="block truncate font-bold">{r.subject}</span><span className="text-xs text-fg-mute">{CATS.find((c) => c[0] === r.category)?.[1]} · updated {timeAgo(r.updatedAt)} · {r.responses.filter((x) => x.by === 'admin').length} replies</span></span><Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge></button>))}</div>)}
      <NewReport open={open} onClose={() => setOpen(false)} onCreated={(id) => { qc.invalidateQueries({ queryKey: ['reports'] }); setSel(id); }} />
      {current && <ReportDetail report={current} onClose={() => setSel(null)} />}
    </div>
  );
};

const NewReport = ({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) => {
  const [f, setF] = useState({ category: 'bug', subject: '', description: '' });
  const [files, setFiles] = useState<File[]>([]);
  const fileIn = useRef<HTMLInputElement>(null);
  const m = useMutation({
    mutationFn: async () => { const fd = new FormData(); Object.entries(f).forEach(([k, v]) => fd.append(k, v)); files.forEach((x) => fd.append('files', x)); return (await api.post('/support/reports', fd, { headers: { 'Content-Type': 'multipart/form-data' } })).data.report as Report; },
    onSuccess: (r) => { toast.success('Report submitted', 'We will reply in the conversation.'); setF({ category: 'bug', subject: '', description: '' }); setFiles([]); onClose(); onCreated(r.id); }, onError: (e) => toast.error('Could not submit', errorMessage(e)),
  });
  const valid = f.subject.trim().length >= 4 && f.description.trim().length >= 10;
  return (
    <Modal open={open} onClose={onClose} title="Create a report" description="The more detail you give, the faster we can help.">
      <form onSubmit={(e) => { e.preventDefault(); if (valid) m.mutate(); }} className="space-y-4">
        <Field label="Category"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATS.map(([id, l]) => <option key={id} value={id}>{l}</option>)}</Select></Field>
        <Field label="Subject"><Input value={f.subject} maxLength={140} onChange={(e) => setF({ ...f, subject: e.target.value })} placeholder="Short summary" /></Field>
        <Field label="Description" hint="At least 10 characters."><Textarea value={f.description} maxLength={4000} onChange={(e) => setF({ ...f, description: e.target.value })} className="min-h-[130px]" /></Field>
        <div><input ref={fileIn} type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf" className="sr-only" onChange={(e) => setFiles([...files, ...Array.from(e.target.files || [])].slice(0, 3))} aria-label="Attachments" />
          <Button type="button" variant="secondary" size="sm" onClick={() => fileIn.current?.click()} disabled={files.length >= 3}><Paperclip className="h-4 w-4" />Attach files</Button>
          {files.length > 0 && <ul className="mt-2 space-y-1">{files.map((x, i) => <li key={i} className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-1.5 text-sm"><span className="truncate">{x.name}</span><button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label={`Remove ${x.name}`}><X className="h-4 w-4 text-fg-mute" /></button></li>)}</ul>}</div>
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={m.isPending} disabled={!valid}>Submit report</Button></div>
      </form>
    </Modal>
  );
};

const ReportDetail = ({ report, onClose }: { report: Report; onClose: () => void }) => {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const inv = () => qc.invalidateQueries({ queryKey: ['reports'] });
  const reply = useMutation({ mutationFn: async () => api.post(`/support/reports/${report.id}/reply`, { text }), onSuccess: () => { setText(''); inv(); }, onError: (e) => toast.error('Could not send', errorMessage(e)) });
  const status = useMutation({ mutationFn: async (s: string) => api.post(`/support/reports/${report.id}/status`, { status: s }), onSuccess: () => { inv(); toast.success('Report updated'); }, onError: (e) => toast.error('Could not update', errorMessage(e)) });
  return (
    <Modal open onClose={onClose} title={report.subject} width="max-w-2xl">
      <div className="mb-4 flex flex-wrap items-center gap-2"><Badge tone={STATUS_TONE[report.status]}>{STATUS_LABEL[report.status]}</Badge><span className="text-xs text-fg-mute">{CATS.find((c) => c[0] === report.category)?.[1]} · opened {formatDate(report.createdAt)}</span></div>
      <div className="space-y-3">
        <div className="rounded-2xl border border-line bg-white/[0.03] p-4 text-sm"><p className="whitespace-pre-wrap">{report.description}</p>{report.attachments.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{report.attachments.map((a) => <a key={a.url} href={fileUrl(a.url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-xs font-semibold text-violet-300"><Paperclip className="h-3 w-3" />{a.name}</a>)}</div>}</div>
        {report.responses.map((r, i) => <div key={i} className={cn('rounded-2xl p-4 text-sm', r.by === 'admin' ? 'border border-violet-400/25 bg-violet-500/[0.08]' : 'ml-8 bg-white/[0.05]')}><p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-fg-mute">{r.by === 'admin' ? 'Nexora support' : 'You'} · {timeAgo(r.at)}</p><p className="whitespace-pre-wrap">{r.text}</p></div>)}
      </div>
      {report.history.length > 0 && <details className="mt-4 text-xs text-fg-mute"><summary className="cursor-pointer font-semibold">Status history</summary><ul className="mt-2 space-y-1">{report.history.map((h, i) => <li key={i}>{formatDate(h.at)} — {STATUS_LABEL[h.status] || h.status} ({h.by})</li>)}</ul></details>}
      {report.status !== 'closed' && <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) reply.mutate(); }} className="mt-5 flex gap-2"><Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a reply…" maxLength={2000} aria-label="Reply" /><Button type="submit" loading={reply.isPending} disabled={!text.trim()} aria-label="Send reply"><Send className="h-4 w-4" /></Button></form>}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        {['resolved', 'closed'].includes(report.status) && <Button variant="secondary" onClick={() => status.mutate('reopened')} loading={status.isPending}>Reopen</Button>}
        {report.status !== 'closed' && <Button variant="ghost" onClick={() => status.mutate('closed')} loading={status.isPending}>Close report</Button>}
      </div>
    </Modal>
  );
};

export default function Support() {
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') === 'reports' ? 'reports' : 'chat';
  return (
    <div>
      <PageHeader title="Support" subtitle="Chat with our team in real time, or file a report and track it." />
      <Tabs className="mb-6" tabs={[{ id: 'chat', label: 'Chat with Admin' }, { id: 'reports', label: 'Reports' }]} value={tab} onChange={(v) => setSp({ tab: v }, { replace: true })} />
      {tab === 'chat' ? <Chat /> : <Reports />}
    </div>
  );
}
