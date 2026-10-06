import { Types } from 'mongoose';
import { Capability, ProviderName, ToolId } from '../config/tools';
import { Artifact } from '../models/Artifact';
import { Generation } from '../models/Generation';
import { User } from '../models/User';
import { AppError, forbidden, notFound } from '../utils/errors';
import { logger } from '../utils/logger';
import { emitToUser } from '../sockets/io';
import { AdapterInput } from './providers';
import { Attempt, routeRequest } from './providerRouter';
import { commitCredits, ensureFreshCredits, releaseCredits, reserveCredits } from './credit.service';
import { adminEvent, notify } from './notification.service';
import { getToolConfig } from './settings.service';
import { saveFile } from './storage.service';

export interface ArtifactSpec {
  kind: 'text' | 'pdf' | 'image' | 'audio' | 'video' | 'code' | 'resume' | 'data' | 'response' | 'file';
  title: string;
  mimeType?: string;
  content?: string;
  buffer?: Buffer;
  meta?: Record<string, unknown>;
}

export interface HandlerResult {
  output: any;
  title: string;
  artifact?: ArtifactSpec;
  /** Overrides the stored input (e.g. to avoid persisting big uploads). */
  inputSummary?: Record<string, unknown>;
}

export interface HandlerContext {
  userId: string;
  route: (capability: Capability, input: Omit<AdapterInput, 'capability'>, order?: ProviderName[]) => ReturnType<typeof routeRequest>;
  progress: (label: string) => void;
}

export type ToolHandler<I> = (input: I, ctx: HandlerContext) => Promise<HandlerResult>;

export const generationDto = (g: any) => ({
  id: String(g._id),
  tool: g.tool,
  title: g.title,
  input: g.input,
  output: g.output,
  provider: g.provider,
  model: g.model,
  status: g.status,
  creditsUsed: g.creditsUsed,
  artifactId: g.artifactId ? String(g.artifactId) : undefined,
  latency: g.latency,
  error: g.error,
  fallbackUsed: g.fallbackUsed,
  favorite: g.favorite,
  createdAt: g.createdAt,
});

const clip = (v: unknown, n = 60000) => (typeof v === 'string' && v.length > n ? v.slice(0, n) : v);

export const persistArtifact = async (ownerId: string, tool: string, spec: ArtifactSpec, generationId?: Types.ObjectId) => {
  let url: string | undefined;
  let storage: { provider: string; key: string } | undefined;
  let size = spec.content ? Buffer.byteLength(spec.content) : 0;
  if (spec.buffer && spec.mimeType) {
    const stored = await saveFile(spec.buffer, { folder: spec.kind === 'image' ? 'images' : spec.kind, mime: spec.mimeType, ownerId });
    url = stored.url;
    storage = { provider: stored.provider, key: stored.key };
    size = stored.size;
  }
  return Artifact.create({
    ownerId, title: spec.title.slice(0, 200), kind: spec.kind, tool, generationId, mimeType: spec.mimeType,
    content: spec.content, url, storage, size, meta: spec.meta, source: 'generated',
  });
};

/**
 * The single pipeline every AI tool goes through:
 * auth (upstream) → plan access → credit validation/reservation → provider router →
 * persist generation + artifact → charge once → notify → admin monitoring.
 */
export const runTool = async <I>(opts: { toolId: ToolId; userId: string; input: I; handler: ToolHandler<I> }) => {
  const tool = await getToolConfig(opts.toolId);
  if (!tool || !tool.enabled) throw notFound('This tool is not available right now.', 'TOOL_DISABLED');

  const fresh = await ensureFreshCredits(opts.userId);
  if (!fresh.isActive) throw forbidden('This account is deactivated.', 'ACCOUNT_DEACTIVATED');
  if (tool.plan === 'pro' && fresh.plan !== 'pro') {
    throw new AppError(403, 'PRO_REQUIRED', `${tool.name} is a Pro feature. Upgrade to Nexora Pro to use it.`);
  }

  await reserveCredits(opts.userId, tool.credits);

  const attempts: Attempt[] = [];
  let lastProvider: string | undefined;
  let lastModel: string | undefined;
  const started = Date.now();

  const ctx: HandlerContext = {
    userId: opts.userId,
    progress: (label) => emitToUser(opts.userId, 'generation:progress', { tool: tool.id, label }),
    route: async (capability, input, order) => {
      const out = await routeRequest(capability, order || tool.providers, input);
      attempts.push(...out.attempts);
      lastProvider = out.result.provider;
      lastModel = out.result.model;
      return out;
    },
  };

  try {
    const result = await opts.handler(opts.input, ctx);
    const latency = Date.now() - started;
    const fallbackUsed = attempts.some((a) => !a.ok) && attempts.some((a) => a.ok);

    const generation = await Generation.create({
      userId: opts.userId, tool: tool.id, title: result.title.slice(0, 200),
      input: result.inputSummary ?? opts.input, output: clip(result.output),
      provider: lastProvider, model: lastModel, status: 'completed', creditsUsed: tool.credits,
      latency, fallbackUsed, attempts: attempts.map((a) => ({ ...a })),
    });

    let artifact;
    if (result.artifact) {
      artifact = await persistArtifact(opts.userId, tool.id, result.artifact, generation._id);
      generation.artifactId = artifact._id;
      await generation.save();
    }

    // Provider fallback still counts as ONE generation: charge the configured cost exactly once.
    const balance = await commitCredits(opts.userId, tool.credits, { tool: tool.id, generationId: generation._id });
    emitToUser(opts.userId, 'credits:update', { credits: balance });

    void notify(opts.userId, artifact && ['image', 'audio', 'video', 'pdf'].includes(artifact.kind) ? 'file' : 'generation', artifact && ['image', 'audio', 'video', 'pdf'].includes(artifact.kind) ? 'File generated' : `${tool.name} finished`, result.title, artifact ? `/app/workspace?artifact=${artifact._id}` : '/app/history');
    adminEvent('generation', { tool: tool.id, provider: lastProvider, status: 'completed', latency, userId: opts.userId });

    return { generation, artifact, creditsRemaining: balance, creditCost: tool.credits };
  } catch (e) {
    await releaseCredits(opts.userId, tool.credits);
    const err = e instanceof AppError ? e : new AppError(500, 'GENERATION_FAILED', 'We could not complete this generation.', { cause: (e as Error)?.message });
    await Generation.create({
      userId: opts.userId, tool: tool.id, title: `${tool.name} (failed)`, input: opts.input as any, status: 'failed', creditsUsed: 0,
      provider: lastProvider, model: lastModel, latency: Date.now() - started, error: (e as Error).message?.slice(0, 500),
      attempts: attempts.map((a) => ({ ...a })), fallbackUsed: false,
    }).catch(() => undefined);
    adminEvent('generation', { tool: tool.id, status: 'failed', error: err.code, userId: opts.userId });
    if (!(e instanceof AppError)) logger.error('tool handler crashed', { tool: tool.id, err: (e as Error).stack });
    if (err.status >= 500) {
      throw new AppError(err.status, err.code, `${err.message} Your credits were not charged.`, err.details);
    }
    throw err;
  }
};

export const creditSnapshot = async (userId: string) => {
  const u = await ensureFreshCredits(userId);
  const fresh = await User.findById(userId).select('credits reservedCredits creditsResetAt plan').lean();
  return { credits: fresh?.credits ?? u.credits, resetsAt: fresh?.creditsResetAt, plan: fresh?.plan ?? u.plan };
};