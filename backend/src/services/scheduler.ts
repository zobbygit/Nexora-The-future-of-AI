import { Announcement } from '../models/Announcement';
import { dispatchAnnouncement } from '../controllers/admin.controller';
import { logger } from '../utils/logger';

let timer: NodeJS.Timeout | null = null;

/** Dispatches announcements whose scheduled time has arrived (checked every 30s). */
export const startScheduler = () => {
  const tick = async () => {
    try {
      const due = await Announcement.find({ status: 'scheduled', scheduledFor: { $lte: new Date() } }).select('_id').limit(20).lean();
      for (const a of due) await dispatchAnnouncement(a._id);
    } catch (e) { logger.warn('scheduler tick failed', { err: (e as Error).message }); }
  };
  timer = setInterval(tick, 30_000);
  timer.unref();
  void tick();
};
export const stopScheduler = () => { if (timer) clearInterval(timer); timer = null; };
