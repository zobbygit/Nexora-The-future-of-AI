import { isTest } from '../config/env';

type Level = 'debug' | 'info' | 'warn' | 'error';
const write = (level: Level, msg: string, meta?: unknown) => {
  if (isTest && level !== 'error') return;
  const line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...(meta ? { meta } : {}) });
  (level === 'error' ? console.error : console.log)(line);
};

export const logger = {
  debug: (m: string, meta?: unknown) => write('debug', m, meta),
  info: (m: string, meta?: unknown) => write('info', m, meta),
  warn: (m: string, meta?: unknown) => write('warn', m, meta),
  error: (m: string, meta?: unknown) => write('error', m, meta),
};
