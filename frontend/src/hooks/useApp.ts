import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import type { Bootstrap, NotificationItem } from '@/lib/types';
import { toast } from '@/store/ui';
import { useAuth } from '@/store/auth';

export const useBootstrap = () =>
  useQuery({ queryKey: ['bootstrap'], queryFn: async () => (await api.get<Bootstrap>('/bootstrap')).data, staleTime: 30_000 });

/** Connects the user socket once inside the app shell and keeps caches live. */
export const useRealtime = () => {
  const qc = useQueryClient();
  const userId = useAuth((s) => s.user?.id);
  useEffect(() => {
    if (!userId) return;
    const s = getSocket('user');
    const onNotif = (n: NotificationItem) => {
      qc.setQueryData<Bootstrap>(['bootstrap'], (b) => (b ? { ...b, unreadNotifications: b.unreadNotifications + 1 } : b));
      qc.invalidateQueries({ queryKey: ['notifications'] });
      toast.info(n.title, n.body);
    };
    const onCredits = (p: { credits: number }) => qc.setQueryData<Bootstrap>(['bootstrap'], (b) => (b ? { ...b, credits: p.credits } : b));
    const onCollab = () => { qc.invalidateQueries({ queryKey: ['collab'] }); qc.invalidateQueries({ queryKey: ['artifacts'] }); };
    const onChat = (m: { sender: string }) => { if (m.sender === 'admin' && !window.location.pathname.startsWith('/app/support')) qc.setQueryData<Bootstrap>(['bootstrap'], (b) => (b ? { ...b, unreadChat: (b.unreadChat ?? 0) + 1 } : b)); };
    s.on('chat:message', onChat);
    s.on('notification:new', onNotif); s.on('credits:update', onCredits); s.on('collab:update', onCollab);
    return () => { s.off('chat:message', onChat); s.off('notification:new', onNotif); s.off('credits:update', onCredits); s.off('collab:update', onCollab); };
  }, [userId, qc]);
};
