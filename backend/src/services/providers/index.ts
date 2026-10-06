import { ProviderName } from '../../config/tools';
import { clipdrop } from './clipdrop';
import { cloudflare } from './cloudflare';
import { groq } from './groq';
import { huggingface } from './huggingface';
import { openrouter } from './openrouter';
import { ProviderAdapter } from './types';

export const ADAPTERS: Record<ProviderName, ProviderAdapter> = { openrouter, groq, huggingface, cloudflare, clipdrop };
export * from './types';
