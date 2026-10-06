import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { isProd } from '../config/env';
import { ErrorLog } from '../models/Setting';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found.` } });
};

/** Centralised, safe error responses: internals never leak, 5xx errors are recorded for admins. */
export const errorHandler = (err: any, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'That file is too large.' : 'The upload could not be processed.';
    return res.status(400).json({ error: { code: err.code, message } });
  }
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON.' } });
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request is too large.' } });
  if (err?.message === 'Not allowed by CORS') return res.status(403).json({ error: { code: 'CORS', message: 'Origin not allowed.' } });

  if (err instanceof AppError) {
    if (err.status >= 500) void ErrorLog.create({ status: err.status, code: err.code, message: err.message, path: req.path, method: req.method }).catch(() => undefined);
    return res.status(err.status).json({ error: { code: err.code, message: err.message, ...(err.details && !isProd ? { details: err.details } : {}) } });
  }
  if (err?.name === 'ValidationError') return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Some fields are invalid.' } });
  if (err?.name === 'CastError') return res.status(400).json({ error: { code: 'BAD_ID', message: 'Invalid identifier.' } });
  if (err?.code === 11000) return res.status(409).json({ error: { code: 'DUPLICATE', message: 'That value is already in use.' } });

  logger.error('unhandled error', { path: req.path, err: err?.stack || String(err) });
  void ErrorLog.create({ status: 500, code: 'INTERNAL', message: String(err?.message || err).slice(0, 300), path: req.path, method: req.method, stack: isProd ? undefined : err?.stack }).catch(() => undefined);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong on our side. Please try again.' } });
};
