import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env';
import { EXT } from '../utils/sniff';

export interface StoredFile { provider: 'cloudinary' | 'local'; key: string; url: string; size: number }

const cloudinaryReady = () => !!env.CLOUDINARY_CLOUD_NAME && !!env.CLOUDINARY_API_KEY && !!env.CLOUDINARY_API_SECRET;
if (cloudinaryReady()) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME, api_key: env.CLOUDINARY_API_KEY, api_secret: env.CLOUDINARY_API_SECRET, secure: true,
  });
}

export const LOCAL_DIR = path.resolve(process.cwd(), 'storage');

const resourceType = (mime: string) => (mime.startsWith('image/') ? 'image' : mime.startsWith('video/') || mime.startsWith('audio/') ? 'video' : 'raw');

/** Binary files never enter MongoDB: they go to Cloudinary (or local disk in development). */
export const saveFile = async (buffer: Buffer, opts: { folder: string; mime: string; ownerId: string }): Promise<StoredFile> => {
  const id = crypto.randomBytes(12).toString('hex');
  if (cloudinaryReady() && opts.mime !== 'image/svg+xml') {
    const res = await new Promise<any>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: `nexora/${opts.folder}`, public_id: id, resource_type: resourceType(opts.mime) },
        (err, out) => (err ? reject(err) : resolve(out)),
      );
      stream.end(buffer);
    });
    return { provider: 'cloudinary', key: res.public_id, url: res.secure_url, size: buffer.length };
  }
  const ext = EXT[opts.mime] || (opts.mime === 'image/svg+xml' ? 'svg' : 'bin');
  const key = `${opts.folder}/${opts.ownerId}/${id}.${ext}`;
  const full = path.join(LOCAL_DIR, key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, buffer);
  return { provider: 'local', key, url: `/api/files/${key}`, size: buffer.length };
};

export const readLocal = async (key: string): Promise<Buffer> => {
  const full = path.resolve(LOCAL_DIR, key);
  if (!full.startsWith(LOCAL_DIR + path.sep)) throw new Error('Invalid path');
  return fs.readFile(full);
};

export const deleteFile = async (file?: { provider?: string | null; key?: string | null }, mime?: string) => {
  if (!file?.key) return;
  try {
    if (file.provider === 'cloudinary' && cloudinaryReady()) {
      await cloudinary.uploader.destroy(file.key, { resource_type: resourceType(mime || '') });
    } else if (file.provider === 'local') {
      const full = path.resolve(LOCAL_DIR, file.key);
      if (full.startsWith(LOCAL_DIR + path.sep)) await fs.rm(full, { force: true });
    }
  } catch {
    /* best effort */
  }
};
