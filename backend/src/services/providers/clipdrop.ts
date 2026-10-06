import { env } from '../../config/env';
import { formWith, request } from './http';
import { AdapterInput, AdapterResult, ProviderAdapter, ProviderError } from './types';

export const clipdrop: ProviderAdapter = {
  name: 'clipdrop',
  supports: ['image.removeBg', 'image.enhance'],
  isConfigured: () => !!env.CLIPDROP_API_KEY,
  async run(input: AdapterInput): Promise<AdapterResult> {
    if (!env.CLIPDROP_API_KEY) throw new ProviderError('clipdrop', 'Clipdrop is not configured', undefined, 'config');
    if (!input.image) throw new ProviderError('clipdrop', 'Image required', 400, 'bad_input');
    const headers = { 'x-api-key': env.CLIPDROP_API_KEY };
    const file = { name: 'image_file', buffer: input.image.buffer, mime: input.image.mime, filename: 'image' };

    if (input.capability === 'image.removeBg') {
      const res = await request('clipdrop', 'https://clipdrop-api.co/remove-background/v1', {
        method: 'POST', headers, body: formWith({}, file), timeoutMs: 90000,
      });
      return { provider: 'clipdrop', model: 'remove-background-v1', buffer: Buffer.from(await res.arrayBuffer()), mime: 'image/png' };
    }
    const { targetWidth, targetHeight } = input.options || {};
    const res = await request('clipdrop', 'https://clipdrop-api.co/image-upscaling/v1/upscale', {
      method: 'POST', headers,
      body: formWith({ target_width: String(targetWidth), target_height: String(targetHeight) }, file), timeoutMs: 120000,
    });
    return { provider: 'clipdrop', model: 'image-upscaling-v1', buffer: Buffer.from(await res.arrayBuffer()), mime: 'image/jpeg' };
  },
};
