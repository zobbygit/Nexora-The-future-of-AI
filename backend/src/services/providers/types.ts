import { Capability, ProviderName } from '../../config/tools';

export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }

export interface AdapterInput {
  capability: Capability;
  messages?: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  text?: string | string[];
  audio?: { buffer: Buffer; mime: string; filename?: string };
  image?: { buffer: Buffer; mime: string };
  prompt?: string;
  options?: Record<string, any>;
}

export interface AdapterResult {
  provider: ProviderName;
  model: string;
  text?: string;
  buffer?: Buffer;
  mime?: string;
  segments?: Array<{ start: number; end: number; text: string }>;
  embeddings?: number[][];
}

export interface ProviderAdapter {
  name: ProviderName;
  supports: Capability[];
  isConfigured(): boolean;
  run(input: AdapterInput): Promise<AdapterResult>;
}

export class ProviderError extends Error {
  constructor(
    public provider: ProviderName,
    message: string,
    public status?: number,
    public kind: 'rate_limit' | 'timeout' | 'unavailable' | 'model' | 'server' | 'network' | 'config' | 'bad_input' = 'server',
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
