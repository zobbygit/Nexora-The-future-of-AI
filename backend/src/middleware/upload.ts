import multer from 'multer';
import { Request } from 'express';
import { badRequest } from '../utils/errors';
import { sniffMime } from '../utils/sniff';

export const upload = (maxMb: number, files = 1) =>
  multer({ storage: multer.memoryStorage(), limits: { fileSize: maxMb * 1024 * 1024, files, fields: 30 } });

export interface CheckedFile { buffer: Buffer; mime: string; filename: string; size: number }

/** Validates the real file type by magic bytes; the client-declared MIME type is never trusted. */
export const checkFile = (file: Express.Multer.File | undefined, allowed: string[], label = 'file'): CheckedFile => {
  if (!file) throw badRequest(`Attach a ${label} first.`, 'FILE_REQUIRED');
  const mime = sniffMime(file.buffer);
  if (!mime || !allowed.includes(mime)) throw badRequest(`That ${label} type is not supported.`, 'UNSUPPORTED_FILE_TYPE');
  const filename = file.originalname.replace(/[^\w.\- ]+/g, '_').slice(0, 100) || 'upload';
  return { buffer: file.buffer, mime, filename, size: file.size };
};

export const bodyFrom = (req: Request) => req.body ?? {};
