import { Request, Response } from 'express';
import { z } from 'zod';
import { Artifact } from '../models/Artifact';
import { Collaboration } from '../models/Collaboration';
import { Generation } from '../models/Generation';
import { DocChunk, DocumentModel } from '../models/Document';
import { Notification } from '../models/Notification';
import { artifactDto, requireRole, resolveAccess } from '../services/artifact.service';
import { generationDto } from '../services/ai.service';
import { markdownToPlain, renderPdf } from '../services/pdf.service';
import { deleteFile, readLocal, LOCAL_DIR } from '../services/storage.service';
import { notify } from '../services/notification.service';
import { emitToUser } from '../sockets/io';
import { User } from '../models/User';
import { asyncHandler } from '../utils/asyncHandler';
import { badRequest, conflict, forbidden, notFound } from '../utils/errors';
import { cleanText, escapeRegex } from '../utils/sanitize';
import { checkFile } from '../middleware/upload';
import { AUDIO_MIMES, IMAGE_MIMES, VIDEO_MIMES, EXT } from '../utils/sniff';
import { saveFile } from '../services/storage.service';
import { Types } from 'mongoose';
import path from 'path';

const kindFromMime = (m: string) => (m.startsWith('image/') ? 'image' : m.startsWith('audio/') ? 'audio' : m.startsWith('video/') ? 'video' : m === 'application/pdf' ? 'pdf' : 'file');

export const listArtifacts = asyncHandler(async (req: Request, res: Response) => {
  const uid = req.userId!;
  const { q, kind, scope = 'mine', favorite, tool, sort = 'recent' } = req.query as Record<string, string>;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(Number(req.query.limit) || 24, 60);

  let filter: any;
  const roles = new Map<string, { role: 'viewer' | 'editor'; canDownload: boolean }>();
  if (scope === 'shared') {
    const collabs = await Collaboration.find({ collaboratorId: uid }).lean();
    collabs.forEach((c) => roles.set(String(c.artifactId), { role: c.permission as any, canDownload: c.canDownload }));
    filter = { _id: { $in: collabs.map((c) => c.artifactId) } };
  } else filter = { ownerId: uid };
  if (kind && kind !== 'all') filter.kind = String(kind);
  if (tool) filter.tool = String(tool);
  if (favorite === 'true') filter.favorite = true;
  if (q) filter.title = new RegExp(escapeRegex(String(q).slice(0, 80)), 'i');
  if (scope === 'files') filter.source = 'upload';
  if (scope === 'recent') filter.updatedAt = { $gte: new Date(Date.now() - 7 * 864e5) };

  const [items, total] = await Promise.all([
    Artifact.find(filter).select('-content').sort(sort === 'name' ? { title: 1 } : { updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Artifact.countDocuments(filter),
  ]);
  res.json({
    items: items.map((a) => { const r = roles.get(String(a._id)); return artifactDto(a, r?.role || 'owner', r?.canDownload ?? true); }),
    total, page, pages: Math.ceil(total / limit),
  });
});

export const getArtifact = asyncHandler(async (req, res) => {
  const { artifact, role, canDownload } = await resolveAccess(req.params.id, req.userId!);
  res.json({ artifact: artifactDto(artifact, role, canDownload) });
});

export const updateArtifact = asyncHandler(async (req, res) => {
  const body = z.object({
    title: z.string().trim().min(1).max(200).optional(), content: z.string().max(500000).optional(),
    favorite: z.boolean().optional(), tags: z.array(z.string().max(30)).max(10).optional(),
  }).parse(req.body);
  const access = await resolveAccess(req.params.id, req.userId!);
  // Favorite/tags are personal to the owner; editors may modify title and content only.
  if (body.favorite !== undefined || body.tags) requireRole(access, 'owner');
  if (body.title !== undefined || body.content !== undefined) requireRole(access, 'editor');
  if (body.content !== undefined && !['text', 'code', 'resume', 'response'].includes(access.artifact.kind)) throw badRequest('This item cannot be edited as text.');
  const a = access.artifact;
  if (body.title !== undefined) a.title = cleanText(body.title, 200);
  if (body.content !== undefined) { a.content = body.content; a.size = Buffer.byteLength(body.content); }
  if (body.favorite !== undefined) a.favorite = body.favorite;
  if (body.tags) a.tags = body.tags;
  await a.save();
  if (access.role === 'editor') {
    void notify(a.ownerId, 'collab_update', 'Shared item edited', `${req.user.name} edited “${a.title}”.`, `/app/workspace?artifact=${a._id}`);
    const others = await Collaboration.find({ artifactId: a._id, collaboratorId: { $ne: req.userId } }).select('collaboratorId').lean();
    others.forEach((c) => emitToUser(String(c.collaboratorId), 'collab:update', { artifactId: String(a._id) }));
  }
  emitToUser(String(a.ownerId), 'collab:update', { artifactId: String(a._id) });
  res.json({ artifact: artifactDto(a, access.role, access.canDownload) });
});

export const deleteArtifact = asyncHandler(async (req, res) => {
  const access = await resolveAccess(req.params.id, req.userId!);
  requireRole(access, 'owner');
  const a = access.artifact;
  await Promise.all([
    deleteFile(a.storage as any, a.mimeType || undefined), Collaboration.deleteMany({ artifactId: a._id }),
    Generation.updateMany({ artifactId: a._id }, { $unset: { artifactId: 1 } }),
  ]);
  const doc = await DocumentModel.findOne({ artifactId: a._id });
  if (doc) { await DocChunk.deleteMany({ documentId: doc._id }); await doc.deleteOne(); }
  await a.deleteOne();
  res.json({ ok: true });
});

/** Uploads a file into the workspace (My Files). */
export const uploadFile = asyncHandler(async (req: Request, res: Response) => {
  const f = checkFile(req.file, [...IMAGE_MIMES, ...AUDIO_MIMES, ...VIDEO_MIMES, 'application/pdf'], 'file');
  const stored = await saveFile(f.buffer, { folder: 'files', mime: f.mime, ownerId: req.userId! });
  const a = await Artifact.create({ ownerId: req.userId, title: f.filename, kind: kindFromMime(f.mime), mimeType: f.mime, url: stored.url, storage: { provider: stored.provider, key: stored.key }, size: stored.size, source: 'upload' });
  res.status(201).json({ artifact: artifactDto(a) });
});

/** Streams local-disk files (development storage) after checking artifact access. */
export const serveFile = asyncHandler(async (req: Request, res: Response) => {
    const key = req.params.key || req.params[0];
  if (!key || key.includes('..')) throw notFound();
  const artifact = await Artifact.findOne({ 'storage.provider': 'local', 'storage.key': key });
  if (artifact) await resolveAccess(String(artifact._id), req.userId!);
  else if (!key.startsWith(`avatars/`)) throw notFound();
  const buf = await readLocal(key).catch(() => { throw notFound(); });
  const ext = path.extname(key).slice(1);
  const mime = Object.entries(EXT).find(([, v]) => v === ext)?.[0] || (ext === 'svg' ? 'image/svg+xml' : 'application/octet-stream');
  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.send(buf);
});
void LOCAL_DIR;

/** Export a document-style artifact as PDF. */
export const exportArtifactPdf = asyncHandler(async (req, res) => {
  const { artifact, canDownload } = await resolveAccess(req.params.id, req.userId!);
  if (!canDownload) throw forbidden('The owner has not allowed downloads.');
  if (!artifact.content || !['text', 'code', 'resume', 'response', 'data'].includes(artifact.kind)) throw badRequest('This item cannot be exported as PDF.');
  const body = artifact.content; let sections;
  if (artifact.kind === 'data') {
    const d = JSON.parse(artifact.content);
    sections = [
      { heading: 'Key insights', body: markdownToPlain(d.insights || '') },
      { heading: 'Dataset', body: `${d.rows} rows × ${d.columns} columns · ${d.duplicates} duplicate rows` },
      { heading: 'Column statistics', table: { head: ['Column', 'Type', 'Nulls', 'Unique', 'Min', 'Mean', 'Max'], rows: (d.columnStats || []).map((c: any) => [c.name, c.type, String(c.nulls), String(c.unique), c.min ?? '', c.mean ?? '', c.max ?? ''].map(String)) } },
    ];
  } else sections = [{ body: markdownToPlain(body) }];
  const pdf = await renderPdf(artifact.title, sections, `Generated with Nexora · ${new Date(artifact.createdAt).toDateString()}`);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${artifact.title.replace(/[^\w\- ]+/g, '').slice(0, 60) || 'nexora'}.pdf"`);
  res.send(pdf);
});

// ── History ──────────────────────────────────────────────
export const listHistory = asyncHandler(async (req, res) => {
  const { q, tool, from, to, favorite, status } = req.query as Record<string, string>;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const filter: any = { userId: req.userId };
  if (tool) filter.tool = String(tool);
  if (status === 'completed' || status === 'failed') filter.status = status;
  if (favorite === 'true') filter.favorite = true;
  if (q) filter.title = new RegExp(escapeRegex(String(q).slice(0, 80)), 'i');
  if (from || to) filter.createdAt = { ...(from ? { $gte: new Date(from) } : {}), ...(to ? { $lte: new Date(new Date(to).getTime() + 864e5 - 1) } : {}) };
  const [items, total] = await Promise.all([
    Generation.find(filter).select('-input -output').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Generation.countDocuments(filter),
  ]);
  res.json({ items: items.map(generationDto), total, page, pages: Math.ceil(total / limit) });
});

export const getGeneration = asyncHandler(async (req, res) => {
  const g = await Generation.findOne({ _id: req.params.id, userId: req.userId }).lean();
  if (!g) throw notFound('Generation not found.');
  res.json({ generation: generationDto(g) });
});

export const favoriteGeneration = asyncHandler(async (req, res) => {
  const { favorite } = z.object({ favorite: z.boolean() }).parse(req.body);
  const g = await Generation.findOneAndUpdate({ _id: req.params.id, userId: req.userId }, { favorite }, { new: true });
  if (!g) throw notFound('Generation not found.');
  if (g.artifactId) await Artifact.updateOne({ _id: g.artifactId, ownerId: req.userId }, { favorite });
  res.json({ generation: generationDto(g) });
});

export const deleteGeneration = asyncHandler(async (req, res) => {
  const g = await Generation.findOneAndDelete({ _id: req.params.id, userId: req.userId });
  if (!g) throw notFound('Generation not found.');
  res.json({ ok: true });
});

export const exportHistory = asyncHandler(async (req, res) => {
  const format = req.params.format;
  const gens = await Generation.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(1000).lean();
  if (format === 'json') {
    res.setHeader('Content-Disposition', 'attachment; filename="nexora-history.json"');
    return res.json({ exportedAt: new Date().toISOString(), count: gens.length, generations: gens.map((g) => ({ tool: g.tool, title: g.title, status: g.status, provider: g.provider, model: g.model, creditsUsed: g.creditsUsed, latencyMs: g.latency, favorite: g.favorite, createdAt: g.createdAt })) });
  }
  const totalCredits = gens.reduce((a, g) => a + (g.creditsUsed || 0), 0);
  const pdf = await renderPdf('Generation history', [
    { heading: 'Summary', body: `${gens.length} generations · ${totalCredits} credits used · exported ${new Date().toDateString()}` },
    { table: { head: ['Date', 'Tool', 'Title', 'Provider', 'Credits', 'Status'], rows: gens.map((g) => [new Date(g.createdAt as any).toISOString().slice(0, 10), g.tool, (g.title || '').slice(0, 40), g.provider || '—', String(g.creditsUsed || 0), g.status]) } },
  ], `${req.user.name} · Nexora`);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="nexora-history.pdf"');
  res.send(pdf);
});

// ── Collaboration ─────────────────────────────────────────
const shareSchema = z.object({
  artifactId: z.string().regex(/^[a-f\d]{24}$/i), identifier: z.string().trim().min(2).max(120),
  permission: z.enum(['viewer', 'editor']).default('viewer'), canDownload: z.boolean().optional(),
});

export const shareArtifact = asyncHandler(async (req, res) => {
  const b = shareSchema.parse(req.body);
  const access = await resolveAccess(b.artifactId, req.userId!);
  requireRole(access, 'owner');
  const isEmail = b.identifier.includes('@');
  const matches = await User.find(isEmail ? { email: b.identifier.toLowerCase() } : { name: new RegExp(`^${escapeRegex(b.identifier)}$`, 'i') }).select('_id name email isActive').limit(2);
  if (!matches.length) throw notFound('No Nexora user matches that name or email.', 'USER_NOT_FOUND');
  if (matches.length > 1) throw conflict('More than one person has that name. Use their email instead.', 'AMBIGUOUS_USER');
  const target = matches[0];
  if (!target.isActive) throw notFound('No Nexora user matches that name or email.', 'USER_NOT_FOUND');
  if (String(target._id) === req.userId) throw badRequest('You already own this item.', 'SELF_SHARE');
  const existing = await Collaboration.findOne({ artifactId: b.artifactId, collaboratorId: target._id });
  const collab = await Collaboration.findOneAndUpdate(
    { artifactId: b.artifactId, collaboratorId: target._id },
    { ownerId: req.userId, permission: b.permission, canDownload: b.canDownload ?? true },
    { upsert: true, new: true },
  );
  void notify(target._id, existing ? 'collab_update' : 'collab_invite', existing ? 'Access updated' : 'Shared with you', `${req.user.name} gave you ${b.permission} access to “${access.artifact.title}”.`, `/app/collaboration`);
  emitToUser(String(target._id), 'collab:update', { artifactId: b.artifactId });
  res.status(existing ? 200 : 201).json({ collaboration: collabDto(collab, target) });
});

const collabDto = (c: any, user?: any) => ({
  id: String(c._id), artifactId: String(c.artifactId), permission: c.permission, canDownload: c.canDownload, createdAt: c.createdAt,
  user: user ? { id: String(user._id), name: user.name, email: user.email, avatarUrl: user.avatarUrl } : undefined,
});

export const listCollaborators = asyncHandler(async (req, res) => {
  const access = await resolveAccess(req.params.artifactId, req.userId!);
  requireRole(access, 'owner');
  const rows = await Collaboration.find({ artifactId: access.artifact._id }).populate('collaboratorId', 'name email avatarUrl').lean();
  res.json({ collaborators: rows.map((c: any) => collabDto(c, c.collaboratorId)) });
});

export const updateCollaboration = asyncHandler(async (req, res) => {
  const b = z.object({ permission: z.enum(['viewer', 'editor']).optional(), canDownload: z.boolean().optional() }).parse(req.body);
  const c = await Collaboration.findOne({ _id: req.params.id, ownerId: req.userId });
  if (!c) throw notFound('Collaboration not found.');
  if (b.permission) c.permission = b.permission;
  if (b.canDownload !== undefined) c.canDownload = b.canDownload;
  await c.save();
  void notify(c.collaboratorId, 'collab_update', 'Permission changed', `Your access is now ${c.permission}.`, '/app/collaboration');
  emitToUser(String(c.collaboratorId), 'collab:update', { artifactId: String(c.artifactId) });
  res.json({ collaboration: collabDto(c) });
});

export const revokeCollaboration = asyncHandler(async (req, res) => {
  const c = await Collaboration.findById(req.params.id);
  if (!c || (String(c.ownerId) !== req.userId && String(c.collaboratorId) !== req.userId)) throw notFound('Collaboration not found.');
  const leaving = String(c.collaboratorId) === req.userId;
  await c.deleteOne();
  const other = leaving ? c.ownerId : c.collaboratorId;
  void notify(other, 'collab_update', leaving ? 'A collaborator left' : 'Access removed', leaving ? `${req.user.name} left a shared item.` : `${req.user.name} removed your access to a shared item.`, '/app/collaboration');
  emitToUser(String(other), 'collab:update', { artifactId: String(c.artifactId) });
  res.json({ ok: true });
});

export const collabOverview = asyncHandler(async (req, res) => {
  const uid = req.userId!;
  const [byMe, withMe] = await Promise.all([
    Collaboration.find({ ownerId: uid }).sort({ updatedAt: -1 }).populate('artifactId', 'title kind').populate('collaboratorId', 'name email avatarUrl').lean(),
    Collaboration.find({ collaboratorId: uid }).sort({ updatedAt: -1 }).populate('artifactId', 'title kind').populate('ownerId', 'name email avatarUrl').lean(),
  ]);
  const shape = (c: any, who: any) => ({ ...collabDto(c, who), artifact: c.artifactId ? { id: String(c.artifactId._id), title: c.artifactId.title, kind: c.artifactId.kind } : null });
  res.json({
    sharedByMe: byMe.filter((c: any) => c.artifactId).map((c: any) => shape(c, c.collaboratorId)),
    sharedWithMe: withMe.filter((c: any) => c.artifactId).map((c: any) => shape(c, c.ownerId)),
  });
});

export const searchUsers = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 60);
  if (q.length < 3) return res.json({ users: [] });
  const rx = new RegExp(`^${escapeRegex(q)}`, 'i');
  const users = await User.find({ _id: { $ne: req.userId }, isActive: true, $or: [{ name: rx }, { email: rx }] }).select('name email avatarUrl').limit(5).lean();
  res.json({ users: users.map((u) => ({ id: String(u._id), name: u.name, email: u.email, avatarUrl: u.avatarUrl })) });
});

// ── Notifications ────────────────────────────────────────
export const listNotifications = asyncHandler(async (req, res) => {
  const filter: any = { userId: req.userId };
  if (req.query.unread === 'true') filter.read = false;
  const page = Math.max(1, Number(req.query.page) || 1);
  const [items, unread, total] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * 30).limit(30).lean(),
    Notification.countDocuments({ userId: req.userId, read: false }), Notification.countDocuments(filter),
  ]);
  res.json({ items: items.map((n) => ({ id: String(n._id), type: n.type, title: n.title, body: n.body, link: n.link, read: n.read, createdAt: (n as any).createdAt })), unread, total, page });
});
export const markRead = asyncHandler(async (req, res) => {
  await Notification.updateOne({ _id: req.params.id, userId: req.userId }, { read: true });
  res.json({ ok: true });
});
export const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ userId: req.userId, read: false }, { read: true });
  res.json({ ok: true });
});
export const deleteNotification = asyncHandler(async (req, res) => {
  await Notification.deleteOne({ _id: req.params.id, userId: req.userId });
  res.json({ ok: true });
});
void Types;

/** Records a completed download (client reports it after the file is saved) so it appears in the notification centre. */
export const downloadCompleted = asyncHandler(async (req, res) => {
  const { artifact } = await resolveAccess(req.params.id, req.userId!);
  void notify(req.userId!, 'download', 'Download completed', artifact.title, `/app/workspace?artifact=${artifact._id}`);
  res.json({ ok: true });
});
