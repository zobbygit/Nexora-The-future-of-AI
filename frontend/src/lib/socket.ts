import { io, Socket } from 'socket.io-client';
import { api } from '@/lib/api';
import { SOCKET_URL } from '@/lib/env';

const sockets: Partial<Record<'user' | 'admin', Socket>> = {};

/**
 * The socket authenticates with a short-lived ticket fetched over the normal (cookie-authenticated) API.
 * That keeps real-time features working in browsers that block third-party cookies, e.g. Vercel app + Render API.
 * The auth callback runs on every (re)connect, so each attempt gets a fresh ticket.
 */
export const getSocket = (role: 'user' | 'admin'): Socket => {
  const existing = sockets[role];
  if (existing) return existing;
  const s = io(SOCKET_URL || undefined, {
    withCredentials: true,
    transports: ['websocket', 'polling'],
    reconnectionDelayMax: 8000,
    auth: (cb) => {
      api.get(role === 'admin' ? '/admin/auth/socket-token' : '/auth/socket-token')
        .then((r) => cb({ role, token: r.data.token }))
        .catch(() => cb({ role }));
    },
  });
  sockets[role] = s;
  return s;
};
export const closeSocket = (role: 'user' | 'admin') => { sockets[role]?.disconnect(); delete sockets[role]; };