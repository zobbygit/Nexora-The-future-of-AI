import { z } from 'zod';
import { HandlerResult, ToolHandler } from '../ai.service';
import { retrieve } from '../rag.service';
import { agentSchema, codeSchema, resumeSchema, writerSchema } from './schemas';
import { fence, firstLine, stripJsonFence, sys, user } from './helpers';

const LENGTH_HINT = { short: 'about 150-250 words', medium: 'about 400-600 words', long: 'about 900-1200 words' };
const WRITING_HINT: Record<string, string> = {
  blog: 'a blog post with a strong title, short intro, scannable sections and a conclusion',
  email: 'an email with a subject line, greeting, clear body and sign-off',
  essay: 'a structured essay with thesis, supporting paragraphs and conclusion',
  social: 'a set of social posts tailored to the platform implied by the prompt',
  story: 'a short story with a clear arc',
  product: 'product copy with a headline, benefits and a call to action',
  speech: 'a spoken speech with rhythm, pauses and a memorable close',
  summary: 'a concise summary with key points',
};

export const writerHandler: ToolHandler<z.infer<typeof writerSchema>> = async (input, ctx): Promise<HandlerResult> => {
  ctx.progress('Drafting');
  const out = await ctx.route('text.generate', {
    temperature: 0.8, maxTokens: 2600,
    messages: [
      sys('You are Nexora Writer, an expert writer. Output clean Markdown only, no preamble.',
        `Write ${WRITING_HINT[input.writingType]}. Tone: ${input.tone}. Length: ${LENGTH_HINT[input.length]}. Language: ${input.language}.`),
      user(fence('brief', input.prompt)),
    ],
  });
  const text = out.result.text || '';
  return { output: text, title: firstLine(text, 'Untitled draft'), artifact: { kind: 'text', title: firstLine(text, 'Untitled draft'), mimeType: 'text/markdown', content: text, meta: { writingType: input.writingType, tone: input.tone } } };
};

export const resumeHandler: ToolHandler<z.infer<typeof resumeSchema>> = async (input, ctx): Promise<HandlerResult> => {
  ctx.progress(input.mode === 'resume' ? 'Building resume' : 'Writing cover letter');
  const profile = JSON.stringify({ personal: input.personal, education: input.education, experience: input.experience, projects: input.projects, skills: input.skills }, null, 1);
  const task = input.mode === 'resume'
    ? `Create a one-page ATS-friendly resume in Markdown. Use "# Name", a contact line, then sections: Summary, Experience, Projects, Education, Skills. ${input.improve ? 'Strengthen bullets: start with strong verbs, quantify impact only when the data supports it, never invent facts.' : 'Keep the candidate\'s wording; only fix formatting and grammar.'}`
    : 'Write a concise, specific cover letter (250-350 words) in Markdown. Do not invent facts. Address the hiring team, connect 2-3 real strengths to the role, close with a clear next step.';
  const out = await ctx.route('text.generate', {
    temperature: 0.6, maxTokens: 2400,
    messages: [
      sys('You are Nexora Resume, a careful career writer. Output Markdown only.', task),
      user(`Target role: ${input.targetRole || 'not specified'}\n${fence('candidate-profile', profile)}\n${input.jobDescription ? fence('job-description', input.jobDescription) : ''}`),
    ],
  });
  const text = out.result.text || '';
  const title = `${input.mode === 'resume' ? 'Resume' : 'Cover letter'} — ${input.personal.name}`;
  return {
    output: text, title, inputSummary: { mode: input.mode, name: input.personal.name, targetRole: input.targetRole, style: input.style },
    artifact: { kind: 'resume', title, mimeType: 'text/markdown', content: text, meta: { mode: input.mode, style: input.style } },
  };
};

export const codeHandler: ToolHandler<z.infer<typeof codeSchema>> = async (input, ctx): Promise<HandlerResult> => {
  ctx.progress('Reading code');
  const verbs = {
    explain: 'Explain what the code does, step by step, then note pitfalls.',
    debug: 'Find the bugs. List each with the cause and the fix, then give the corrected code.',
    improve: 'Improve readability, performance and safety. Explain each change briefly, then give the full improved code.',
    generate: 'Generate the requested code with brief usage notes.',
    refactor: 'Refactor for clarity and maintainability without changing behavior. Show the refactored code, then list what changed.',
  } as const;
  const out = await ctx.route('text.generate', {
    temperature: 0.3, maxTokens: 3000,
    messages: [
      sys('You are Nexora Code, a senior software engineer. Use Markdown with fenced code blocks that declare the language.',
        `Language: ${input.language}. Task: ${verbs[input.mode]}`),
      user(`${input.instructions ? `Instructions: ${input.instructions}\n` : ''}${input.code ? fence('code', input.code, 20000) : ''}`),
    ],
  });
  const text = out.result.text || '';
  const title = `${input.mode[0].toUpperCase()}${input.mode.slice(1)} · ${input.language}`;
  return { output: text, title, inputSummary: { mode: input.mode, language: input.language, codeChars: input.code.length, instructions: input.instructions }, artifact: { kind: 'code', title, mimeType: 'text/markdown', content: text, meta: { language: input.language, mode: input.mode } } };
};

export interface AgentStep { id: number; label: string; tool: string; status: 'done' | 'skipped'; detail?: string }

export const agentHandler = (ownerId: string): ToolHandler<z.infer<typeof agentSchema>> => async (input, ctx): Promise<HandlerResult> => {
  const steps: AgentStep[] = [];
  ctx.progress('Thinking…');

  // 1. Plan — high-level actions only. The model's reasoning is never stored or shown.
  const allowed = input.documentId ? ['search_document', 'draft'] : ['draft'];
  const planOut = await ctx.route('text.generate', {
    temperature: 0.2, maxTokens: 400,
    messages: [
      sys('You plan work for an assistant.', `Respond ONLY with valid JSON: {"steps":[{"action":"${allowed.join('|')}","input":"short instruction"}]}. Use at most 3 steps.`),
      user(fence('goal', input.goal, 3000)),
    ],
  });
  let plan: Array<{ action: string; input: string }> = [];
  try {
    plan = (JSON.parse(stripJsonFence(planOut.result.text || '')).steps || []).filter((s: any) => allowed.includes(s.action)).slice(0, 3);
  } catch { /* fall through to default plan */ }
  if (!plan.length) plan = [{ action: input.documentId ? 'search_document' : 'draft', input: input.goal }];

  // 2. Act
  const notes: string[] = [];
  for (const [i, s] of plan.entries()) {
    if (s.action === 'search_document' && input.documentId) {
      ctx.progress('Using PDF AI…');
      const hits = await retrieve({ ownerId, documentId: input.documentId, query: String(s.input || input.goal), k: 5 });
      notes.push(fence('document-excerpts', hits.map((h) => `[p${h.page}] ${h.snippet}`).join('\n\n'), 10000));
      steps.push({ id: i + 1, label: 'Analyzing document', tool: 'PDF AI', status: 'done', detail: `${hits.length} relevant passages found` });
    } else {
      ctx.progress('Creating draft…');
      steps.push({ id: i + 1, label: 'Preparing response', tool: 'Nexora', status: 'done' });
    }
  }

  // 3. Final answer
  ctx.progress('Creating summary…');
  const final = await ctx.route('text.generate', {
    temperature: 0.5, maxTokens: 2400,
    messages: [
      sys('You are the Nexora AI Agent. Deliver a complete, well-organised final answer in Markdown. Cite document pages as [p3] when you use excerpts.'),
      user(`${fence('goal', input.goal, 3000)}\n${notes.join('\n')}`),
    ],
  });
  const text = final.result.text || '';
  steps.push({ id: steps.length + 1, label: 'Completed', tool: 'Nexora', status: 'done' });
  return {
    output: { answer: text, steps }, title: firstLine(input.goal, 'Agent task', 60),
    inputSummary: { goal: input.goal, documentId: input.documentId },
    artifact: { kind: 'response', title: firstLine(input.goal, 'Agent task', 60), mimeType: 'text/markdown', content: text, meta: { steps } },
  };
};
