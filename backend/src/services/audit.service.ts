import { AuditLog } from '../models/AuditLog';
import { logger } from '../utils/logger';

export const audit = async (admin: string, action: string, target?: string, metadata?: Record<string, unknown>) => {
  try {
    await AuditLog.create({ admin, action, target, metadata });
  } catch (e) {
    logger.error('audit log failed', { err: (e as Error).message, action });
  }
};
