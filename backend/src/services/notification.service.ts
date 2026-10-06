import { Types } from 'mongoose';
import { Notification, NOTIFICATION_TYPES } from '../models/Notification';
import { emitToAdmins, emitToUser } from '../sockets/io';
import { logger } from '../utils/logger';

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const notify = async (
  userId: string | Types.ObjectId,
  type: NotificationType,
  title: string,
  body = '',
  link?: string,
  extra: Record<string, unknown> = {},
) => {
  try {
    const n = await Notification.create({ userId, type, title, body, link, ...extra });
    emitToUser(String(userId), 'notification:new', {
      id: String(n._id), type, title, body, link, read: false, createdAt: n.createdAt,
    });
    return n;
  } catch (e) {
    logger.warn('notify failed', { err: (e as Error).message });
  }
};

export const notifyMany = async (
  userIds: Array<string | Types.ObjectId>,
  type: NotificationType,
  title: string,
  body: string,
  extra: Record<string, unknown> = {},
) => {
  if (!userIds.length) return 0;
  const docs = await Notification.insertMany(userIds.map((userId) => ({ userId, type, title, body, ...extra })));
  docs.forEach((n) =>
    emitToUser(String(n.userId), 'notification:new', {
      id: String(n._id), type, title, body, read: false, createdAt: n.createdAt,
    }),
  );
  return docs.length;
};

/** Admin monitoring feed — every notable platform event lands here in real time. */
export const adminEvent = (kind: string, payload: Record<string, unknown>) =>
  emitToAdmins('admin:event', { kind, at: new Date().toISOString(), ...payload });
