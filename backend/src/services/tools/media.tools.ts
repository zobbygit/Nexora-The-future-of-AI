import { z } from 'zod';
import { HandlerResult, ToolHandler } from '../ai.service';
import { badRequest } from '../../utils/errors';
import { imageSize } from '../../utils/imageSize';
import { EXT } from '../../utils/sniff';
import { enhanceSchema, imageToTextSchema, sttSchema, textToImageSchema, ttsSchema } from './schemas';
import { ASPECT, firstLine } from './helpers';

export interface Upload { buffer: Buffer; mime: string; filename: string }

export const ttsHandler: ToolHandler<z.infer<typeof ttsSchema>> = async (input, ctx): Promise<HandlerResult> => {
  ctx.progress('Synthesizing voice');
  const out = await ctx.route('speech.tts', { text: input.text, options: { lang: input.voice, speed: input.speed } });
  const r = out.result;
  const title = firstLine(input.text, 'Speech', 50);
  return {
    output: { mime: r.mime }, title, inputSummary: { chars: input.text.length, voice: input.voice, speed: input.speed, text: input.text.slice(0, 500) },
    artifact: { kind: 'audio', title: `Speech — ${title}`, mimeType: r.mime || 'audio/mpeg', buffer: r.buffer, meta: { voice: input.voice, text: input.text.slice(0, 500) } },
  };
};

const transcribe = (capability: 'speech.stt' | 'video.stt', kind: 'audio' | 'video', label: string) =>
  (file: Upload, opts: z.infer<typeof sttSchema>): ToolHandler<Record<string, never>> => async (_i, ctx): Promise<HandlerResult> => {
    ctx.progress('Transcribing');
    const out = await ctx.route(capability, {
      audio: { buffer: file.buffer, mime: file.mime, filename: `${file.filename.replace(/\.[^.]+$/, '')}.${EXT[file.mime] || 'bin'}` },
      options: { language: opts.language },
    });
    const text = (out.result.text || '').trim();
    if (!text) throw badRequest('No speech was detected in that file.', 'NO_SPEECH');
    const segments = out.result.segments || [];
    const title = `${label} — ${file.filename}`;
    return {
      output: { text, segments }, title, inputSummary: { filename: file.filename, bytes: file.buffer.length, mime: file.mime },
      artifact: { kind: 'text', title, mimeType: 'text/markdown', content: text, meta: { segments, source: file.filename, sourceKind: kind } },
    };
  };
export const sttHandler = transcribe('speech.stt', 'audio', 'Transcript');
export const videoHandler = transcribe('video.stt', 'video', 'Video transcript');

export const imageToTextHandler = (file: Upload, opts: z.infer<typeof imageToTextSchema>): ToolHandler<Record<string, never>> => async (_i, ctx): Promise<HandlerResult> => {
  ctx.progress('Reading image');
  const prompt = opts.mode === 'extract'
    ? 'Extract all text visible in this image exactly as written, preserving line breaks and reading order. Output only the text.'
    : 'Describe this image clearly and concisely, including any visible text.';
  const out = await ctx.route('vision.ocr', { image: { buffer: file.buffer, mime: file.mime }, prompt, options: { mode: opts.mode } });
  const text = (out.result.text || '').trim();
  const title = `${opts.mode === 'extract' ? 'Extracted text' : 'Description'} — ${file.filename}`;
  return { output: { text }, title, inputSummary: { filename: file.filename, mode: opts.mode }, artifact: { kind: 'text', title, mimeType: 'text/markdown', content: text, meta: { mode: opts.mode } } };
};

export const backgroundHandler = (file: Upload): ToolHandler<Record<string, never>> => async (_i, ctx): Promise<HandlerResult> => {
  ctx.progress('Removing background');
  const out = await ctx.route('image.removeBg', { image: { buffer: file.buffer, mime: file.mime } });
  const title = `Cutout — ${file.filename}`;
  return { output: { mime: out.result.mime }, title, inputSummary: { filename: file.filename }, artifact: { kind: 'image', title, mimeType: out.result.mime || 'image/png', buffer: out.result.buffer, meta: { operation: 'background-removed' } } };
};

export const enhanceHandler = (file: Upload, opts: z.infer<typeof enhanceSchema>): ToolHandler<Record<string, never>> => async (_i, ctx): Promise<HandlerResult> => {
  const dims = imageSize(file.buffer);
  if (!dims) throw badRequest('We could not read that image\'s size.', 'INVALID_IMAGE');
  // Clipdrop upscaling caps output at 4096px per side.
  const scale = Math.min(opts.scale, 4096 / Math.max(dims.width, dims.height));
  if (scale < 1.05) throw badRequest('That image is already at the maximum supported size.', 'IMAGE_TOO_LARGE');
  ctx.progress('Enhancing image');
  const out = await ctx.route('image.enhance', {
    image: { buffer: file.buffer, mime: file.mime },
    options: { targetWidth: Math.round(dims.width * scale), targetHeight: Math.round(dims.height * scale) },
  });
  const title = `Enhanced ${opts.scale}× — ${file.filename}`;
  return { output: { from: dims, to: { width: Math.round(dims.width * scale), height: Math.round(dims.height * scale) } }, title, inputSummary: { filename: file.filename, scale: opts.scale }, artifact: { kind: 'image', title, mimeType: out.result.mime || 'image/jpeg', buffer: out.result.buffer, meta: { operation: 'enhanced', scale: opts.scale } } };
};

const STYLE: Record<string, string> = {
  none: '', photographic: ', photorealistic, natural light, high detail', cinematic: ', cinematic lighting, dramatic composition, film still',
  illustration: ', detailed digital illustration', '3d': ', soft 3D render, studio lighting', minimal: ', minimalist composition, clean negative space',
};

export const textToImageHandler: ToolHandler<z.infer<typeof textToImageSchema>> = async (input, ctx): Promise<HandlerResult> => {
  ctx.progress('Generating image');
  const size = ASPECT[input.aspectRatio];
  const prompt = `${input.prompt}${STYLE[input.style]}${input.negative ? `. Avoid: ${input.negative}` : ''}`;
  const out = await ctx.route('image.generate', { prompt, options: { ...size, steps: 6 } });
  const title = firstLine(input.prompt, 'Generated image', 60);
  return {
    output: { mime: out.result.mime, ...size }, title, inputSummary: { prompt: input.prompt, aspectRatio: input.aspectRatio, style: input.style },
    artifact: { kind: 'image', title, mimeType: out.result.mime || 'image/png', buffer: out.result.buffer, meta: { prompt: input.prompt, aspectRatio: input.aspectRatio, style: input.style, ...size } },
  };
};
