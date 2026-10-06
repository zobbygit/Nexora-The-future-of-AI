import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Bell, CheckCheck, CreditCard, FileCheck2, LifeBuoy, Megaphone, Sparkles, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, Pagination, Skeleton, Tabs } from '@/components/ui/primitives';
import { PageHeader } from '@/components/shared/Bits';
import { api } from '@/lib/api';
import type { NotificationItem } from '@/lib/types';
import { cn, errorMessage, timeAgo } from '@/lib/utils';

const ICON: Record<string, typeof Bell> = { generation: Sparkles, file: FileCheck2, processing: FileCheck2, download: FileCheck2, report: LifeBuoy, admin_reply: LifeBuoy, announcement: Megaphone, subscription: CreditCard, payment: CreditCard, collab_invite: Users, collab_update: Users, system: Bell };

export default function Notifications() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [tab, setTab] = useState('all');
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['notifications', tab, page], queryFn: async () => (await api.get('/notifications', { params: { unread: tab === 'unread' ? 'true' : undefined, page } })).data as { items: NotificationItem[]; unread: number; total: number }, placeholderData: (p) => p });
  const inv = () => { qc.invalidateQueries({ queryKey: ['notifications'] }); qc.invalidateQueries({ queryKey: ['bootstrap'] }); };
  const readAll = useMutation({ mutationFn: async () => api.post('/notifications/read-all'), onSuccess: inv });
  const read = useMutation({ mutationFn: async (id: string) => api.post(`/notifications/${id}/read`), onSuccess: inv });
  const remove = useMutation({ mutationFn: async (id: string) => api.delete(`/notifications/${id}`), onSuccess: inv });
  return (
    <div>
      <PageHeader title="Notifications" subtitle="Generations, files, support replies, billing and collaboration — all in one place." actions={<Button variant="secondary" onClick={() => readAll.mutate()} disabled={!data?.unread} loading={readAll.isPending}><CheckCheck className="h-4 w-4" />Mark all as read</Button>} />
      <Tabs className="mb-6" tabs={[{ id: 'all', label: 'All' }, { id: 'unread', label: 'Unread', count: data?.unread }]} value={tab} onChange={(v) => { setTab(v); setPage(1); }} />
      {error ? <ErrorState message={errorMessage(error)} onRetry={() => refetch()} /> : isLoading ? <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[76px]" />)}</div> : !data?.items.length ? <EmptyState icon={<Bell className="h-6 w-6" />} title={tab === 'unread' ? 'No unread notifications' : 'No notifications yet'} body="Updates about your work will show up here." /> : (
        <div className="space-y-2.5">{data.items.map((n, i) => { const I = ICON[n.type] || Bell; return (
          <motion.div key={n.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.025 }} className={cn('surface group flex items-start gap-4 p-4 transition', !n.read && 'border-violet-400/25 bg-violet-500/[0.05]')}>
            <button onClick={() => { if (!n.read) read.mutate(n.id); if (n.link) nav(n.link); }} className="flex min-w-0 flex-1 items-start gap-4 text-left">
              <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-xl', n.read ? 'bg-white/[0.05] text-fg-mute' : 'bg-violet-500/20 text-violet-300')}><I className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="truncate font-bold">{n.title}</span>{!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-violet-400" />}</span><span className="mt-0.5 block text-sm text-fg-mute">{n.body}</span><span className="mt-1.5 block text-xs text-fg-faint">{timeAgo(n.createdAt)}</span></span>
            </button>
            {!n.read && <Button size="icon" variant="ghost" onClick={() => read.mutate(n.id)} aria-label="Mark as read"><CheckCheck className="h-4 w-4" /></Button>}
            <Button size="icon" variant="ghost" className="hover:!text-bad" onClick={() => remove.mutate(n.id)} aria-label="Delete notification"><Trash2 className="h-4 w-4" /></Button>
          </motion.div>); })}
          <Pagination page={page} pages={Math.ceil((data.total || 0) / 30)} onChange={setPage} />
        </div>)}
    </div>
  );
}
