import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, CheckCheck, MessageCircle, Search, Send, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Avatar } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Badge, ErrorState, Input, Modal, Pagination, Select, Skeleton, Tabs } from '@/components/ui/primitives';
import { PageHeader } from '@/components/shared/Bits';
import { api, fileUrl } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { cn, errorMessage, formatDate, timeAgo } from '@/lib/utils';
import { toast } from '@/store/ui';
import { STATUS_LABEL, STATUS_TONE } from '@/pages/app/Support';
import { DataTable } from './adminKit';

/* -------------------------------------------------------------------- */
/*  Reports — unchanged                                                   */
/* -------------------------------------------------------------------- */

const Reports = () => {
  const qc = useQueryClient();
  const [sp, setSp] = useSearchParams();
  const [f, setF] = useState({ q: '', status: '' });
  const [dq, setDq] = useState('');
  const [page, setPage] = useState(1);
  const sel = sp.get('report');
  useEffect(() => { const t = setTimeout(() => { setDq(f.q); setPage(1); }, 300); return () => clearTimeout(t); }, [f.q]);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin-reports', dq, f.status, page], queryFn: async () => (await api.get('/admin/support/reports', { params: { q: dq || undefined, status: f.status || undefined, page, limit: 15 } })).data, placeholderData: (p) => p });
  const detail = useQuery({ queryKey: ['admin-report', sel], enabled: !!sel, queryFn: async () => (await api.get(`/admin/support/reports/${sel}`)).data.report });
  const [text, setText] = useState('');
  const inv = () => { qc.invalidateQueries({ queryKey: ['admin-reports'] }); qc.invalidateQueries({ queryKey: ['admin-report', sel] }); };
  const reply = useMutation({ mutationFn: async (status?: string) => api.post(`/admin/support/reports/${sel}/reply`, { text, status }), onSuccess: () => { setText(''); inv(); toast.success('Reply sent'); }, onError: (e) => toast.error('Failed', errorMessage(e)) });
  const setStatus = useMutation({ mutationFn: async (s: string) => api.post(`/admin/support/reports/${sel}/status`, { status: s }), onSuccess: () => { inv(); toast.success('Status updated'); }, onError: (e) => toast.error('Failed', errorMessage(e)) });
  if (error) return <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />;
  const close = () => { sp.delete('report'); setSp(sp, { replace: true }); };
  const r = detail.data;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3"><div className="relative min-w-[220px] flex-1 sm:max-w-sm"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-mute" /><Input className="pl-10" placeholder="Search subject…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} aria-label="Search reports" /></div>
        <Select value={f.status} onChange={(e) => { setF({ ...f, status: e.target.value }); setPage(1); }} className="!w-auto" aria-label="Status"><option value="">All statuses</option>{Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}{data?.counts?.[k] ? ` (${data.counts[k]})` : ''}</option>)}</Select></div>
      <DataTable loading={isLoading} onRow={(i) => { sp.set('report', data.items[i].id); setSp(sp); }} head={['Subject', 'User', 'Category', 'Status', 'Updated']} rows={(data?.items || []).map((x: any) => [<span key="s" className="block max-w-[280px] truncate font-semibold text-fg">{x.subject}</span>, x.user?.name || '—', x.category.replace('_', ' '), <Badge key="b" tone={STATUS_TONE[x.status]}>{STATUS_LABEL[x.status]}</Badge>, timeAgo(x.updatedAt)])} empty="No reports." />
      <Pagination page={page} pages={data?.pages || 1} onChange={setPage} />
      <Modal open={!!sel} onClose={close} title={r?.subject || 'Report'} description={r ? `${r.user?.name} · ${r.user?.email}` : ''} width="max-w-2xl">
        {!r ? <Skeleton className="h-52" /> : (<div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2"><Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge><span className="text-xs text-fg-mute">{r.category.replace('_', ' ')} · {formatDate(r.createdAt)}</span></div>
          <div className="rounded-2xl border border-line bg-white/[0.03] p-4 text-sm"><p className="whitespace-pre-wrap">{r.description}</p>{r.attachments.map((a: any) => <a key={a.url} href={fileUrl(a.url)} target="_blank" rel="noopener noreferrer" className="mr-2 mt-3 inline-block rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-xs font-semibold text-violet-300">{a.name}</a>)}</div>
          {r.responses.map((x: any, i: number) => <div key={i} className={cn('rounded-2xl p-4 text-sm', x.by === 'admin' ? 'ml-8 border border-violet-400/25 bg-violet-500/[0.08]' : 'bg-white/[0.05]')}><p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-fg-mute">{x.by === 'admin' ? 'You' : r.user?.name} · {timeAgo(x.at)}</p><p className="whitespace-pre-wrap">{x.text}</p></div>)}
          <details className="text-xs text-fg-mute"><summary className="cursor-pointer font-semibold">Status history</summary><ul className="mt-2 space-y-1">{r.history.map((h: any, i: number) => <li key={i}>{formatDate(h.at)} — {STATUS_LABEL[h.status] || h.status} ({h.by}){h.note && ` · ${h.note}`}</li>)}</ul></details>
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a reply…" maxLength={2000} className="field min-h-[90px]" aria-label="Reply" />
          <div className="flex flex-wrap justify-between gap-2"><div className="flex flex-wrap gap-2">{(['in_progress', 'resolved', 'closed'] as const).filter((s) => s !== r.status).map((s) => <Button key={s} size="sm" variant="secondary" loading={setStatus.isPending && setStatus.variables === s} onClick={() => setStatus.mutate(s)}>Mark {STATUS_LABEL[s].toLowerCase()}</Button>)}</div>
            <div className="flex gap-2"><Button variant="secondary" disabled={!text.trim()} loading={reply.isPending} onClick={() => reply.mutate(undefined)}><Send className="h-4 w-4" />Reply</Button><Button disabled={!text.trim()} loading={reply.isPending} onClick={() => reply.mutate('resolved')}>Reply & resolve</Button></div></div></div>)}
      </Modal>
    </div>
  );
};

/* -------------------------------------------------------------------- */
/*  Chat — with per-message delete and clear-conversation                */
/* -------------------------------------------------------------------- */

interface Msg { id: string; sender: 'user' | 'admin'; text: string; readAt?: string; createdAt: string }

const Chat = () => {
  const qc = useQueryClient();
  const [active, setActive] = useState<string>('');
  const [q, setQ] = useState('');
  const [text, setText] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [clearing, setClearing] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const tt = useRef<ReturnType<typeof setTimeout>>();
  const last = useRef(0);

  const list = useQuery({ queryKey: ['admin-convs', q], queryFn: async () => (await api.get('/admin/support/conversations', { params: { q: q || undefined } })).data, refetchInterval: 30_000 });
  const thread = useQuery({ queryKey: ['admin-thread', active], enabled: !!active, queryFn: async () => (await api.get(`/admin/support/conversations/${active}`)).data });
  const found = useQuery({ queryKey: ['admin-chat-users', q], enabled: q.trim().length >= 2, queryFn: async () => (await api.get('/admin/support/users', { params: { q } })).data.users as any[] });

  useEffect(() => {
    if (thread.data) {
      setMsgs(thread.data.messages);
      getSocket('admin').emit('chat:read', { userId: active });
      qc.invalidateQueries({ queryKey: ['admin-convs'] });
      qc.invalidateQueries({ queryKey: ['admin-conv-unread'] });
    }
  }, [thread.data, active, qc]);

  useEffect(() => {
    const s = getSocket('admin');
    const onMsg = (m: Msg & { userId: string }) => {
      if (m.userId === active) {
        setMsgs((x) => (x.some((y) => y.id === m.id) ? x : [...x, m]));
        if (m.sender === 'user') s.emit('chat:read', { userId: active });
      }
      qc.invalidateQueries({ queryKey: ['admin-convs'] });
    };
    const onTyping = (p: { userId: string; typing: boolean }) => {
      if (p.userId !== active) return;
      setTyping(p.typing);
      clearTimeout(tt.current);
      if (p.typing) tt.current = setTimeout(() => setTyping(false), 4000);
    };
    const onRead = (p: { userId: string }) => {
      if (p.userId === active) setMsgs((x) => x.map((m) => (m.sender === 'admin' && !m.readAt ? { ...m, readAt: new Date().toISOString() } : m)));
    };
    const onPresence = () => {
      qc.invalidateQueries({ queryKey: ['admin-convs'] });
      qc.invalidateQueries({ queryKey: ['admin-thread', active] });
    };

    // NEW — react to message / conversation deletions
    const onDeleted = (p: { userId: string; id: string }) => {
      if (p.userId === active) setMsgs((x) => x.filter((m) => m.id !== p.id));
    };
    const onCleared = (p: { userId: string }) => {
      if (p.userId === active) setMsgs([]);
      qc.invalidateQueries({ queryKey: ['admin-convs'] });
    };

    s.on('chat:message', onMsg);
    s.on('chat:typing', onTyping);
    s.on('chat:read', onRead);
    s.on('presence:user', onPresence);
    s.on('chat:deleted', onDeleted);
    s.on('chat:cleared', onCleared);

    return () => {
      s.off('chat:message', onMsg);
      s.off('chat:typing', onTyping);
      s.off('chat:read', onRead);
      s.off('presence:user', onPresence);
      s.off('chat:deleted', onDeleted);
      s.off('chat:cleared', onCleared);
    };
  }, [active, qc]);

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs, typing]);

  const send = () => {
    const t = text.trim();
    if (!t || !active) return;
    getSocket('admin').timeout(8000).emit('chat:send', { userId: active, text: t }, (err: unknown, res: { ok: boolean }) => {
      if (err || !res?.ok) return toast.error('Message not sent');
      setText('');
    });
  };

  // Delete one message in the active conversation — optimistic with rollback.
  const deleteOne = (id: string) => {
    if (!active) return;
    const prev = msgs;
    setMsgs((x) => x.filter((m) => m.id !== id));
    getSocket('admin').timeout(8000).emit('chat:delete', { userId: active, id }, (err: unknown, res: { ok: boolean; error?: string }) => {
      if (err || !res?.ok) {
        setMsgs(prev);
        toast.error('Could not delete', res?.error || 'Try again.');
      }
    });
  };

  // Clear the entire conversation with the active user.
  const clearAll = () => {
    if (!active || !msgs.length) return;
    if (!confirm('Delete the entire conversation with this user? This cannot be undone.')) return;
    setClearing(true);
    const prev = msgs;
    setMsgs([]);
    getSocket('admin').timeout(8000).emit('chat:clear', { userId: active }, (err: unknown, res: { ok: boolean; error?: string }) => {
      setClearing(false);
      if (err || !res?.ok) {
        setMsgs(prev);
        toast.error('Could not clear chat', res?.error || 'Try again.');
      } else {
        toast.success('Conversation cleared');
        qc.invalidateQueries({ queryKey: ['admin-convs'] });
      }
    });
  };

  const u = thread.data?.user;

  return (
    <div className="surface grid h-[calc(100vh-300px)] min-h-[520px] grid-cols-1 overflow-hidden p-0 md:grid-cols-[320px_1fr]">
      {/* Left: conversation list */}
      <div className={cn('flex min-h-0 flex-col border-r border-line', active && 'hidden md:flex')}>
        <div className="p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-mute" />
            <Input className="pl-10" placeholder="Search or start a chat…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search conversations" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {q.trim().length >= 2 && !!found.data?.length && (
            <>
              <p className="label px-3 py-2">Start new</p>
              {found.data.map((x) => (
                <button key={x.id} onClick={() => { setActive(x.id); setQ(''); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-white/[0.05]">
                  <Avatar name={x.name} url={x.avatarUrl} size={36} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{x.name}</span>
                    <span className="block truncate text-xs text-fg-mute">{x.email}</span>
                  </span>
                </button>
              ))}
              <p className="label px-3 py-2">Conversations</p>
            </>
          )}
          {list.isLoading ? (
            <div className="space-y-2 p-2"><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
          ) : !list.data?.items.length ? (
            <p className="px-4 py-10 text-center text-sm text-fg-mute">No conversations yet.</p>
          ) : (
            list.data.items.map((c: any) => (
              <button
                key={c.userId}
                onClick={() => setActive(c.userId)}
                className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition', active === c.userId ? 'bg-violet-500/15' : 'hover:bg-white/[0.05]')}
              >
                <span className="relative">
                  <Avatar name={c.name} url={c.avatarUrl} size={40} />
                  <span className={cn('absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-ink-800', c.online ? 'bg-ok' : 'bg-fg-faint')} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-bold">{c.name}</span>
                    <span className="shrink-0 text-[10px] text-fg-faint">{timeAgo(c.lastAt)}</span>
                  </span>
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-fg-mute">{c.lastSender === 'admin' && 'You: '}{c.lastMessage}</span>
                    {c.unread > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-violet-600 px-1.5 text-[10px] font-bold">{c.unread}</span>}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right: thread */}
      <div className={cn('flex min-h-0 flex-col', !active && 'hidden md:flex')}>
        {!active ? (
          <div className="grid flex-1 place-items-center text-center">
            <div>
              <MessageCircle className="mx-auto mb-3 h-8 w-8 text-violet-300" />
              <p className="font-bold">Select a conversation</p>
              <p className="mt-1 text-sm text-fg-mute">Messages arrive in real time.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b border-line px-4 py-3">
              <button onClick={() => setActive('')} className="text-sm font-semibold text-violet-300 md:hidden" aria-label="Back">‹ Back</button>
              {u && (
                <>
                  <Avatar name={u.name} url={u.avatarUrl} size={38} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{u.name}</p>
                    <p className="truncate text-xs text-fg-mute">{u.online ? 'Online' : 'Offline'} · {u.email} · {u.plan}</p>
                  </div>
                </>
              )}
              {/* Clear conversation */}
              <button
                type="button"
                onClick={clearAll}
                disabled={clearing || msgs.length === 0}
                aria-label="Delete entire conversation"
                title="Delete entire conversation"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-fg-mute transition hover:bg-rose-500/10 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              {thread.isLoading ? (
                <Skeleton className="h-14 w-1/2" />
              ) : (
                msgs.map((m) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn('group flex items-end gap-2', m.sender === 'admin' && 'justify-end')}
                  >
                    {/* Delete button on the left of user messages, right of admin's own */}
                    {m.sender === 'user' && (
                      <button
                        type="button"
                        onClick={() => deleteOne(m.id)}
                        aria-label="Delete message"
                        title="Delete message"
                        className="mb-1 grid h-7 w-7 shrink-0 place-items-center rounded-full text-fg-faint opacity-0 transition hover:bg-rose-500/15 hover:text-rose-300 focus:opacity-100 group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}

                    <div className={cn('max-w-[75%] rounded-2xl px-4 py-2.5 text-sm', m.sender === 'admin' ? 'rounded-br-md bg-violet-600' : 'rounded-bl-md border border-line bg-white/[0.05]')}>
                      <p className="whitespace-pre-wrap break-words">{m.text}</p>
                      <p className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-60">
                        {timeAgo(m.createdAt)}
                        {m.sender === 'admin' && (m.readAt ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />)}
                      </p>
                    </div>

                    {m.sender === 'admin' && (
                      <button
                        type="button"
                        onClick={() => deleteOne(m.id)}
                        aria-label="Delete message"
                        title="Delete message"
                        className="mb-1 grid h-7 w-7 shrink-0 place-items-center rounded-full text-fg-faint opacity-0 transition hover:bg-rose-500/15 hover:text-rose-300 focus:opacity-100 group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </motion.div>
                ))
              )}

              <AnimatePresence>
                {typing && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex">
                    <div className="flex gap-1 rounded-2xl border border-line bg-white/[0.05] px-4 py-3">
                      {[0, 1, 2].map((i) => (
                        <motion.span
                          key={i}
                          className="h-1.5 w-1.5 rounded-full bg-fg-mute"
                          animate={{ y: [0, -4, 0] }}
                          transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.12 }}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div ref={end} />
            </div>

            <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2 border-t border-line p-4">
              <Input
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  const n = Date.now();
                  if (n - last.current > 2000) {
                    last.current = n;
                    getSocket('admin').emit('chat:typing', { userId: active, typing: true });
                  }
                }}
                placeholder="Type a reply…"
                maxLength={2000}
                aria-label="Message"
              />
              <Button type="submit" disabled={!text.trim()} aria-label="Send"><Send className="h-4 w-4" /></Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default function AdminSupport() {
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') === 'chat' ? 'chat' : 'reports';
  return (
    <div className="space-y-6">
      <PageHeader title="Support" eyebrow="Admin" subtitle="Respond to user reports and chat in real time." />
      <Tabs tabs={[{ id: 'reports', label: 'Reports' }, { id: 'chat', label: 'Live chat' }]} value={tab} onChange={(v) => { const n = new URLSearchParams(sp); n.set('tab', v); n.delete('report'); setSp(n, { replace: true }); }} />
      {tab === 'reports' ? <Reports /> : <Chat />}
    </div>
  );
}