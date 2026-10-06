export type Plan = 'free' | 'pro';

export type Capability =
  | 'text.generate'
  | 'speech.tts'
  | 'speech.stt'
  | 'vision.ocr'
  | 'image.removeBg'
  | 'image.enhance'
  | 'image.generate'
  | 'video.stt'
  | 'embeddings';

export type ProviderName = 'openrouter' | 'groq' | 'huggingface' | 'cloudflare' | 'clipdrop';
export const PROVIDERS: ProviderName[] = ['openrouter', 'groq', 'huggingface', 'cloudflare', 'clipdrop'];

export const PROVIDER_LABEL: Record<ProviderName, string> = {
  openrouter: 'OpenRouter',
  groq: 'Groq',
  huggingface: 'Hugging Face',
  cloudflare: 'Cloudflare Workers AI',
  clipdrop: 'Clipdrop',
};

export type ToolId =
  | 'writer'
  | 'resume'
  | 'code'
  | 'agent'
  | 'pdf'
  | 'tts'
  | 'stt'
  | 'image-to-text'
  | 'background-remover'
  | 'image-enhancer'
  | 'data-analyzer'
  | 'text-to-image'
  | 'video-to-text';

export interface ToolDefinition {
  id: ToolId;
  name: string;
  category: 'Write' | 'Audio' | 'Vision' | 'Documents' | 'Generate & Automate';
  plan: Plan;
  credits: number;
  capability: Capability;
  /** Ordered: first is primary, remaining are fallbacks. */
  providers: ProviderName[];
}

/**
 * Single source of truth for the 13 tools. Credit costs and plan access are the
 * defaults — admins can override both at runtime through the Setting collection.
 */
export const TOOLS: ToolDefinition[] = [
  { id: 'writer', name: 'AI Writer', category: 'Write', plan: 'free', credits: 2, capability: 'text.generate', providers: ['openrouter', 'groq', 'cloudflare', 'huggingface'] },
  { id: 'resume', name: 'Resume & Cover AI', category: 'Write', plan: 'free', credits: 3, capability: 'text.generate', providers: ['openrouter', 'groq', 'cloudflare', 'huggingface'] },
  { id: 'code', name: 'Code Assistant', category: 'Write', plan: 'free', credits: 2, capability: 'text.generate', providers: ['openrouter', 'groq', 'cloudflare', 'huggingface'] },
  { id: 'tts', name: 'Text → Speech', category: 'Audio', plan: 'pro', credits: 3, capability: 'speech.tts', providers: ['cloudflare', 'huggingface'] },
  { id: 'stt', name: 'Speech → Text', category: 'Audio', plan: 'pro', credits: 3, capability: 'speech.stt', providers: ['groq', 'cloudflare', 'huggingface'] },
  { id: 'image-to-text', name: 'Image → Text', category: 'Vision', plan: 'pro', credits: 2, capability: 'vision.ocr', providers: ['openrouter', 'cloudflare', 'huggingface'] },
  { id: 'background-remover', name: 'Background Remover', category: 'Vision', plan: 'pro', credits: 4, capability: 'image.removeBg', providers: ['clipdrop'] },
  { id: 'image-enhancer', name: 'Image Enhancer', category: 'Vision', plan: 'pro', credits: 4, capability: 'image.enhance', providers: ['clipdrop'] },
  { id: 'pdf', name: 'PDF AI', category: 'Documents', plan: 'free', credits: 3, capability: 'text.generate', providers: ['openrouter', 'groq', 'cloudflare', 'huggingface'] },
  { id: 'data-analyzer', name: 'Data Analyzer', category: 'Documents', plan: 'pro', credits: 4, capability: 'text.generate', providers: ['openrouter', 'groq', 'cloudflare', 'huggingface'] },
  { id: 'text-to-image', name: 'Text → Image', category: 'Generate & Automate', plan: 'pro', credits: 5, capability: 'image.generate', providers: ['cloudflare', 'huggingface'] },
  { id: 'video-to-text', name: 'Video → Text', category: 'Generate & Automate', plan: 'pro', credits: 6, capability: 'video.stt', providers: ['groq', 'cloudflare', 'huggingface'] },
  { id: 'agent', name: 'AI Agent', category: 'Generate & Automate', plan: 'free', credits: 5, capability: 'text.generate', providers: ['openrouter', 'groq', 'cloudflare', 'huggingface'] },
];

export const TOOL_MAP: Record<string, ToolDefinition> = Object.fromEntries(TOOLS.map((t) => [t.id, t]));

export const getTool = (id: string): ToolDefinition | undefined => TOOL_MAP[id];

export interface PlanConfig {
  id: Plan;
  name: string;
  priceInr: number;
  creditsPerPeriod: number;
  period: 'day' | 'month';
}

export const DEFAULT_PLANS: Record<Plan, PlanConfig> = {
  free: { id: 'free', name: 'Free', priceInr: 0, creditsPerPeriod: 20, period: 'day' },
  pro: { id: 'pro', name: 'Pro', priceInr: 400, creditsPerPeriod: 3000, period: 'month' },
};