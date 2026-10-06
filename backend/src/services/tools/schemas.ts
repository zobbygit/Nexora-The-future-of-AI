import { z } from 'zod';

const str = (max = 8000) => z.string().trim().max(max);

export const writerSchema = z.object({
  prompt: str(6000).min(3),
  writingType: z.enum(['blog', 'email', 'essay', 'social', 'story', 'product', 'speech', 'summary']).default('blog'),
  tone: z.enum(['professional', 'friendly', 'persuasive', 'casual', 'formal', 'witty']).default('professional'),
  length: z.enum(['short', 'medium', 'long']).default('medium'),
  language: str(40).default('English'),
});

export const resumeSchema = z.object({
  mode: z.enum(['resume', 'cover']).default('resume'),
  personal: z.object({
    name: str(80).min(1), email: str(120).optional(), phone: str(30).optional(),
    location: str(80).optional(), links: str(300).optional(), headline: str(120).optional(), summary: str(1000).optional(),
  }),
  education: z.array(z.object({ school: str(120), degree: str(120), period: str(60).optional(), details: str(400).optional() })).max(6).default([]),
  experience: z.array(z.object({ company: str(120), role: str(120), period: str(60).optional(), details: str(1200).optional() })).max(10).default([]),
  projects: z.array(z.object({ name: str(120), stack: str(200).optional(), details: str(800).optional() })).max(10).default([]),
  skills: z.array(str(40)).max(40).default([]),
  targetRole: str(120).optional(),
  jobDescription: str(4000).optional(),
  style: z.enum(['modern', 'classic', 'minimal']).default('modern'),
  improve: z.boolean().default(true),
});

export const codeSchema = z.object({
  mode: z.enum(['explain', 'debug', 'improve', 'generate', 'refactor']),
  language: str(30).default('typescript'),
  code: str(20000).default(''),
  instructions: str(3000).default(''),
}).refine((v) => v.mode === 'generate' ? v.instructions.length > 2 || v.code.length > 2 : v.code.length > 2, {
  message: 'Add some code or instructions first.',
});

export const agentSchema = z.object({ goal: str(3000).min(5), documentId: z.string().regex(/^[a-f\d]{24}$/i).optional() });

export const pdfAskSchema = z.object({
  documentId: z.string().regex(/^[a-f\d]{24}$/i),
  mode: z.enum(['ask', 'summarize', 'extract', 'analyze']).default('ask'),
  question: str(2000).default(''),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: str(4000) })).max(10).default([]),
}).refine((v) => v.mode !== 'ask' || v.question.length > 1, { message: 'Ask a question about the document.' });

export const ttsSchema = z.object({
  text: str(3000).min(2),
  voice: z.enum(['en', 'es', 'fr', 'zh', 'jp', 'kr']).default('en'),
  speed: z.coerce.number().min(0.5).max(2).default(1),
});

export const sttSchema = z.object({ language: str(8).optional() });
export const imageToTextSchema = z.object({ mode: z.enum(['extract', 'describe']).default('extract'), imageUrl: z.string().url().optional() });
export const enhanceSchema = z.object({ scale: z.coerce.number().refine((n) => n === 2 || n === 4, 'Scale must be 2 or 4').default(2) });

export const textToImageSchema = z.object({
  prompt: str(1500).min(3),
  aspectRatio: z.enum(['1:1', '16:9', '9:16', '4:3', '3:4']).default('1:1'),
  style: z.enum(['none', 'photographic', 'cinematic', 'illustration', '3d', 'minimal']).default('none'),
  negative: str(300).optional(),
});
