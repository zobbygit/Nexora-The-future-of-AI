import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

const bool = z
  .union([z.boolean(), z.string()])
  .transform((v) => v === true || v === 'true' || v === '1')
  .default(false);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  CORS_EXTRA_ORIGINS: z.string().default(''),
  TRUST_PROXY: z.coerce.number().default(1),
  COOKIE_DOMAIN: z.string().default(''),
  COOKIE_SAMESITE: z.enum(['', 'none', 'lax', 'strict']).default(''),

  MONGODB_URI: z.string().default('mongodb://127.0.0.1:27017/nexora'),
  ATLAS_VECTOR_SEARCH: bool,
  ATLAS_VECTOR_INDEX: z.string().default('nexora_docchunk_vectors'),

  JWT_ACCESS_SECRET: z.string().min(16).default('dev-access-secret-change-me-please-32chars'),
  JWT_REFRESH_SECRET: z.string().min(16).default('dev-refresh-secret-change-me-please-32chars'),
  ADMIN_EMAIL: z.string().default('admin@nexora.local'),
  ADMIN_PASSWORD: z.string().default('ChangeMe-Admin-2026!'),

  OPENROUTER_API_KEY: z.string().default(''),
  GROQ_API_KEY: z.string().default(''),
  HF_API_TOKEN: z.string().default(''),
  CLOUDFLARE_ACCOUNT_ID: z.string().default(''),
  CLOUDFLARE_API_TOKEN: z.string().default(''),
  CLIPDROP_API_KEY: z.string().default(''),
  AI_MOCK: bool,

  STRIPE_SECRET_KEY: z.string().default(''),
  STRIPE_PUBLISHABLE_KEY: z.string().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().default(''),
  STRIPE_PRO_PRICE_ID: z.string().default(''),

  CLOUDINARY_CLOUD_NAME: z.string().default(''),
  CLOUDINARY_API_KEY: z.string().default(''),
  CLOUDINARY_API_SECRET: z.string().default(''),

  CREDIT_RESET_OFFSET_MINUTES: z.coerce.number().default(330),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

if (isProd) {
  const weak = [
    env.JWT_ACCESS_SECRET.startsWith('dev-') || env.JWT_ACCESS_SECRET.startsWith('change-me'),
    env.JWT_REFRESH_SECRET.startsWith('dev-') || env.JWT_REFRESH_SECRET.startsWith('change-me'),
    env.ADMIN_PASSWORD === 'ChangeMe-Admin-2026!',
  ];
  if (weak.some(Boolean)) {
    console.error('Refusing to start in production with default secrets. Set JWT_* and ADMIN_PASSWORD.');
    process.exit(1);
  }
}

/** Origins never carry a trailing slash or path; people often paste "https://app.vercel.app/" into env vars. */
const normalizeOrigin = (s: string) => {
  const t = s.trim().replace(/\/+$/, '');
  try { return new URL(t).origin; } catch { return t; }
};
export const allowedOrigins = (): string[] =>
  [env.CLIENT_URL, ...env.CORS_EXTRA_ORIGINS.split(',')].map(normalizeOrigin).filter(Boolean);

export const configWarnings = (): string[] => {
  const w: string[] = [];
  if (isProd && /localhost|127\.0\.0\.1/.test(env.CLIENT_URL)) w.push('CLIENT_URL still points at localhost — browsers on your real frontend will be blocked by CORS.');
  if (isProd && !(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET)) w.push('Cloudinary is not configured — uploaded/generated files are stored on Render\'s ephemeral disk and will be lost on every deploy/restart.');
  if (env.STRIPE_SECRET_KEY && !env.STRIPE_WEBHOOK_SECRET) w.push('STRIPE_WEBHOOK_SECRET is missing — payments will succeed but plans will only update through the billing sync fallback.');
  if (isProd && env.COOKIE_SAMESITE === 'none' && !env.CLIENT_URL.startsWith('https')) w.push('SameSite=None cookies require https on both sides.');
  return w;
};