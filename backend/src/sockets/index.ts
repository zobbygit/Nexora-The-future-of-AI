import http from 'http';
import { Server, Socket } from 'socket.io';
import { allowedOrigins } from '../config/env';
import { Message } from '../models/Message';
import { User } from '../models/User';
import { getSystem } from '../services/settings.service';
import { notify } from '../services/notification.service';
import { cleanText } from '../utils/sanitize';
import { COOKIES, verifyAccess, verifySocketToken } from '../utils/tokens';
import { logger } from '../utils/logger';
import { setIo } from './io';
import { adminConnected, adminDisconnected, isUserOnline, userConnected, userDisconnected } from './presence';

const parseCookies = (header = ''): Record<string, string> =>
  Object.fromEntries(header.split(';').map((p) => p.trim()).filter(Boolean).map((p) => { const i = p.indexOf('='); return [p.slice(0, i), decodeURIComponent(p.slice(i + 1))]; }));

type Identity = { kind: 'user'; id: string; name: string } | { kind: 'admin' };

const identify = async (socket: Socket): Promise<Identity | null> => {
  const cookies = parseCookies(socket.handshake.headers.cookie);
  const wantsAdmin = socket.handshake.auth?.role === 'admin';
  const ticket = typeof socket.handshake.auth?.token === 'string' ? socket.handshake.auth.token : '';
  try {
    // Preferred: short-lived ticket (works even when third-party cookies are blocked). Fallback: cookies.
    if (ticket) {
      const t = verifySocketToken(ticket);
      if (wantsAdmin && t.role === 'admin') return { kind: 'admin' };
      if (!wantsAdmin && t.role === 'user') {
        const user = await User.findById(t.sub).select('name isActive');
        if (user && user.isActive) return { kind: 'user', id: String(user._id), name: user.name };
      }
      return null;
    }
    if (wantsAdmin && cookies[COOKIES.admin]) {
      const p = verifyAccess(cookies[COOKIES.admin]);
      if (p.role === 'admin') return { kind: 'admin' };
    }
    if (!wantsAdmin && cookies[COOKIES.access]) {
      const p = verifyAccess(cookies[COOKIES.access]);
      const user = await User.findById(p.sub).select('name isActive tokenVersion');
      if (user && user.isActive && user.tokenVersion === p.tv) return { kind: 'user', id: String(user._id), name: user.name };
    }
  } catch { /* fallthrough */ }
  return null;
};

export const createSocketServer = (server: http.Server) => {
  const io = new Server(server, { cors: { origin: allowedOrigins(), credentials: true }, maxHttpBufferSize: 1e5 });
  setIo(io);

  io.use(async (socket, next) => {
    const who = await identify(socket);
    if (!who) return next(new Error('unauthorized'));
    (socket.data as { who: Identity }).who = who;
    next();
  });

  io.on('connection', (socket) => {
    const who = (socket.data as { who: Identity }).who;

    if (who.kind === 'admin') {
      socket.join('admins');
      adminConnected();
      io.emit('presence:admin', { online: true });
      socket.on('disconnect', () => { if (adminDisconnected()) io.emit('presence:admin', { online: false }); });

      socket.on('chat:send', async (p: { userId?: string; text?: string }, ack?: (r: unknown) => void) => {
        try {
          const text = cleanText(String(p?.text || ''), 2000).trim();
          if (!text || !p?.userId || !/^[a-f\d]{24}$/i.test(p.userId)) return ack?.({ ok: false });
          if (!(await User.exists({ _id: p.userId }))) return ack?.({ ok: false });
          const m = await Message.create({ conversationId: p.userId, sender: 'admin', text });
          const payload = { id: String(m._id), userId: p.userId, sender: 'admin', text, createdAt: (m as any).createdAt };
          io.to(`user:${p.userId}`).emit('chat:message', payload);
          io.to('admins').emit('chat:message', payload);
          if (!isUserOnline(p.userId)) void notify(p.userId, 'admin_reply', 'New message from support', text.slice(0, 120), '/app/support');
          ack?.({ ok: true, message: payload });
        } catch (e) { logger.warn('admin chat failed', { err: (e as Error).message }); ack?.({ ok: false }); }
      });
      socket.on('chat:typing', (p: { userId?: string; typing?: boolean }) => {
        if (p?.userId) io.to(`user:${p.userId}`).emit('chat:typing', { from: 'admin', typing: !!p.typing });
      });
      socket.on('chat:read', async (p: { userId?: string }) => {
        if (!p?.userId || !/^[a-f\d]{24}$/i.test(p.userId)) return;
        await Message.updateMany({ conversationId: p.userId, sender: 'user', readAt: { $exists: false } }, { readAt: new Date() });
        io.to(`user:${p.userId}`).emit('chat:read', { by: 'admin', at: new Date().toISOString() });
        io.to('admins').emit('chat:unread-changed', { userId: p.userId });
      });
      return;
    }

    const uid = who.id;
    socket.join(`user:${uid}`);
    userConnected(uid);
    io.to('admins').emit('presence:user', { userId: uid, online: true });
    socket.emit('presence:admin', { online: io.sockets.adapter.rooms.get('admins')?.size ? true : false });
    User.updateOne({ _id: uid }, { lastActiveAt: new Date() }).catch(() => undefined);

    socket.on('disconnect', () => { if (userDisconnected(uid)) io.to('admins').emit('presence:user', { userId: uid, online: false }); });

    // Simple per-socket flood control for chat.
    let tokens = 8, last = Date.now();
    socket.on('chat:send', async (p: { text?: string }, ack?: (r: unknown) => void) => {
      try {
        const now = Date.now();
        tokens = Math.min(8, tokens + (now - last) / 1500); last = now;
        if (tokens < 1) return ack?.({ ok: false, error: 'You are sending messages too quickly.' });
        tokens -= 1;
        if (!(await getSystem()).supportChatEnabled) return ack?.({ ok: false, error: 'Live chat is currently unavailable. Please file a report.' });
        const text = cleanText(String(p?.text || ''), 2000).trim();
        if (!text) return ack?.({ ok: false });
        const m = await Message.create({ conversationId: uid, sender: 'user', text });
        const payload = { id: String(m._id), userId: uid, sender: 'user', text, createdAt: (m as any).createdAt, name: who.name };
        io.to(`user:${uid}`).emit('chat:message', payload);
        io.to('admins').emit('chat:message', payload);
        ack?.({ ok: true, message: payload });
      } catch (e) { logger.warn('user chat failed', { err: (e as Error).message }); ack?.({ ok: false }); }
    });
    socket.on('chat:typing', (p: { typing?: boolean }) => io.to('admins').emit('chat:typing', { userId: uid, from: 'user', typing: !!p?.typing }));
    socket.on('chat:read', async () => {
      await Message.updateMany({ conversationId: uid, sender: 'admin', readAt: { $exists: false } }, { readAt: new Date() });
      io.to('admins').emit('chat:read', { userId: uid, by: 'user', at: new Date().toISOString() });
    });
  });

  return io;
};