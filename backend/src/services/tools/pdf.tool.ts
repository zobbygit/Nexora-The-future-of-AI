import { z } from 'zod';
import { HandlerResult, ToolHandler } from '../ai.service';
import { authorizedDocument, retrieve } from '../rag.service';
import { pdfAskSchema } from './schemas';
import { fence, firstLine, sys, user } from './helpers';

const MODE_QUERY: Record<string, string> = {
  summarize: 'main topic key points conclusions summary overview',
  extract: 'names dates numbers amounts deadlines key facts entities',
  analyze: 'findings risks strengths weaknesses recommendations implications',
};
const MODE_TASK: Record<string, string> = {
  ask: 'Answer the question using ONLY the excerpts. If the answer is not in them, say so.',
  summarize: 'Write a structured summary: a two-sentence overview, then key points as bullets.',
  extract: 'Extract the key facts as a Markdown table (Item | Value | Page).',
  analyze: 'Give a concise analysis: findings, risks, and recommendations, grounded in the excerpts.',
};

export const pdfHandler = (ownerId: string): ToolHandler<z.infer<typeof pdfAskSchema>> => async (input, ctx): Promise<HandlerResult> => {
  const doc = await authorizedDocument(input.documentId, ownerId);
  ctx.progress('Finding relevant passages');
  const query = input.mode === 'ask' ? input.question : MODE_QUERY[input.mode];
  const hits = await retrieve({ ownerId, documentId: input.documentId, query, k: input.mode === 'ask' ? 6 : 10 });
  const context = hits.map((h) => `[p${h.page}] ${h.snippet}`).join('\n\n');

  ctx.progress('Writing answer');
  const out = await ctx.route('text.generate', {
    temperature: 0.2, maxTokens: 2200,
    messages: [
      sys('You are Nexora PDF AI. Ground every statement in the provided excerpts and cite pages like [p3]. Output Markdown.', MODE_TASK[input.mode]),
      ...input.history.map((h) => ({ role: h.role, content: h.role === 'user' ? fence('earlier-question', h.content, 2000) : h.content.slice(0, 3000) })),
      user(`${input.mode === 'ask' ? fence('question', input.question, 2000) : ''}\n${fence('document-excerpts', context, 20000)}`),
    ],
  });
  const answer = out.result.text || '';
  const title = input.mode === 'ask' ? firstLine(input.question, 'Question', 60) : `${input.mode[0].toUpperCase()}${input.mode.slice(1)} — ${doc.name}`;
  const sources = hits.map((h) => `- p.${h.page}: ${h.snippet.slice(0, 120).replace(/\s+/g, ' ')}…`).join('\n');
  return {
    output: { answer, citations: hits.map((h) => ({ page: h.page, section: h.section, snippet: h.snippet.slice(0, 280), score: h.score })), mode: input.mode },
    title, inputSummary: { documentId: input.documentId, document: doc.name, mode: input.mode, question: input.question },
    artifact: { kind: 'response', title, mimeType: 'text/markdown', content: `${answer}\n\n---\n**Sources**\n${sources}`, meta: { documentId: input.documentId, mode: input.mode } },
  };
};
