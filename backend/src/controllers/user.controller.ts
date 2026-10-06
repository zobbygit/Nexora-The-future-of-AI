import bcrypt from 'bcryptjs';
import { Request, Response } from 'express';
import { z } from 'zod';
import { Artifact } from '../models/Artifact';
import { Collaboration } from '../models/Collaboration';
import { CreditTransaction } from '../models/CreditTransaction';
import { Generation } from '../models/Generation';
import { Message } from '../models/Message';
import { Notification } from '../models/Notification';
import { User, publicUser } from '../models/User';
import { creditSnapshot, generationDto } from '../services/ai.service';
import { artifactDto } from '../services/artifact.service';
import { deleteFile, saveFile } from '../services/storage.service';
import { purgeUserData } from '../services/userPurge.service';
import { getPlans, getTools } from '../services/settings.service';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError, conflict } from '../utils/errors';
import { escapeRegex } from '../utils/sanitize';
import { startOfDayUtc, daysAgo } from '../utils/dates';
import { IMAGE_MIMES } from '../utils/sniff';
import { checkFile } from '../middleware/upload';
import { env } from '../config/env';

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().max(20).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
});

export const onboardingSchema = z.object({
  useCases: z.array(z.string().max(40)).min(1).max(8),
  building: z.array(z.string().max(40)).min(1).max(7),
  goals: z.array(z.string().max(40)).min(1).max(6),
});

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as z.infer<typeof profileSchema>;
  const user = req.user;
  if (body.email && body.email !== user.email) {
    if (body.email === env.ADMIN_EMAIL.toLowerCase() || (await User.exists({ email: body.email, _id: { $ne: user._id } }))) throw conflict('That email is already in use.', 'EMAIL_TAKEN');
    user.email = body.email;
  }
  if (body.name) user.name = body.name;
  if (body.phone !== undefined) user.phone = body.phone;
  await user.save();
  res.json({ user: publicUser(user) });
});

export const uploadAvatar = asyncHandler(async (req: Request, res: Response) => {
  const f = checkFile(req.file, IMAGE_MIMES, 'image');
  const old = await User.findById(req.userId).select('avatarUrl');
  const stored = await saveFile(f.buffer, { folder: 'avatars', mime: f.mime, ownerId: req.userId! });
  await User.updateOne({ _id: req.userId }, { avatarUrl: stored.url });
  if (old?.avatarUrl && !old.avatarUrl.startsWith('http')) void deleteFile({ provider: 'local', key: old.avatarUrl.replace('/api/files/', '') });
  res.json({ avatarUrl: stored.url });
});

export const completeOnboarding = asyncHandler(async (req: Request, res: Response) => {
  const b = req.body as z.infer<typeof onboardingSchema>;
  const user = await User.findByIdAndUpdate(
    req.userId, { onboardingCompleted: true, onboarding: { ...b, completedAt: new Date() } }, { new: true },
  );
  res.json({ user: publicUser(user) });
});

export const deleteAccount = asyncHandler(async (req: Request, res: Response) => {
  const { password } = z.object({ password: z.string().min(1) }).parse(req.body);
  const user = await User.findById(req.userId).select('+passwordHash');
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw new AppError(400, 'WRONG_PASSWORD', 'Your password is incorrect.');
  await purgeUserData(String(user._id));
  res.clearCookie('nx_at'); res.clearCookie('nx_rt', { path: '/api/auth' });
  res.json({ ok: true });
});

export const bootstrap = asyncHandler(async (req: Request, res: Response) => {
  const [snap, tools, plans, unread, unreadChat] = await Promise.all([
    creditSnapshot(req.userId!), getTools(), getPlans(), Notification.countDocuments({ userId: req.userId, read: false }),
    Message.countDocuments({ conversationId: req.userId, sender: 'admin', readAt: { $exists: false } }),
  ]);
  const user = await User.findById(req.userId);
  res.json({
    user: publicUser(user), credits: snap.credits, resetsAt: snap.resetsAt, unreadNotifications: unread, unreadChat, plans,
    tools: tools.map((t) => ({ id: t.id, name: t.name, category: t.category, plan: t.plan, credits: t.credits, enabled: t.enabled, locked: t.plan === 'pro' && user!.plan !== 'pro' })),
  });
});

export const dashboard = asyncHandler(async (req: Request, res: Response) => {
  const uid = req.userId!;
  const snap = await creditSnapshot(uid);
  const today = startOfDayUtc();
  const [todayAgg, weekAgg, recent, artifacts, collab, totalGen, files, shared] = await Promise.all([
    CreditTransaction.aggregate([{ $match: { userId: user_oid(uid), type: 'AI_GENERATION', timestamp: { $gte: today } } }, { $group: { _id: null, credits: { $sum: { $abs: '$amount' } }, count: { $sum: 1 } } }]),
    Generation.aggregate([
      { $match: { userId: user_oid(uid), status: 'completed', createdAt: { $gte: daysAgo(6) } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 }, credits: { $sum: '$creditsUsed' } } },
    ]),
    Generation.find({ userId: uid, status: 'completed' }).sort({ createdAt: -1 }).limit(5).lean(),
    Artifact.find({ ownerId: uid }).sort({ createdAt: -1 }).limit(4).lean(),
    Collaboration.find({ $or: [{ ownerId: uid }, { collaboratorId: uid }] }).sort({ updatedAt: -1 }).limit(4).populate('artifactId', 'title kind').populate('ownerId collaboratorId', 'name').lean(),
    Generation.countDocuments({ userId: uid, status: 'completed' }),
    Artifact.countDocuments({ ownerId: uid }),
    Collaboration.countDocuments({ ownerId: uid }),
  ]);
  const byDay = new Map(weekAgg.map((d) => [d._id, d]));
  const usage = Array.from({ length: 7 }, (_, i) => {
    const d = daysAgo(6 - i);
    const key = d.toISOString().slice(0, 10);
    return { date: key, day: d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }), generations: byDay.get(key)?.count || 0, credits: byDay.get(key)?.credits || 0 };
  });
  res.json({
    credits: snap.credits, resetsAt: snap.resetsAt, plan: snap.plan,
    today: { credits: todayAgg[0]?.credits || 0, generations: todayAgg[0]?.count || 0 },
    totals: { generations: totalGen, artifacts: files, shared },
    usage, recent: recent.map(generationDto), artifacts: artifacts.map((a) => artifactDto(a)),
    collaboration: collab.map((c: any) => ({
      id: String(c._id), permission: c.permission, artifact: c.artifactId ? { id: String(c.artifactId._id), title: c.artifactId.title, kind: c.artifactId.kind } : null,
      owner: c.ownerId?.name, collaborator: c.collaboratorId?.name, at: c.updatedAt, mine: String(c.ownerId?._id) === uid,
    })),
  });
});

// tiny helper to avoid importing Types everywhere
import { Types } from 'mongoose';
function user_oid(id: string) { return new Types.ObjectId(id); }

export const credits = asyncHandler(async (req: Request, res: Response) => {
  const snap = await creditSnapshot(req.userId!);
  const limit = Math.min(Number(req.query.limit) || 25, 100);
  const tx = await CreditTransaction.find({ userId: req.userId }).sort({ timestamp: -1 }).limit(limit).lean();
  res.json({
    ...snap,
    transactions: tx.map((t) => ({ id: String(t._id), type: t.type, amount: t.amount, balanceBefore: t.balanceBefore, balanceAfter: t.balanceAfter, reason: t.reason, tool: t.tool, timestamp: t.timestamp })),
  });
});

/** Cross-cutting user search: artifacts, history and shared items. */
export const search = asyncHandler(async (req: Request, res: Response) => {
  const q = String(req.query.q || '').trim().slice(0, 80);
  if (q.length < 2) return res.json({ artifacts: [], generations: [], shared: [] });
  const rx = new RegExp(escapeRegex(q), 'i');
  const sharedIds = (await Collaboration.find({ collaboratorId: req.userId }).select('artifactId').lean()).map((c) => c.artifactId);
  const [artifacts, generations, shared] = await Promise.all([
    Artifact.find({ ownerId: req.userId, title: rx }).sort({ updatedAt: -1 }).limit(6).lean(),
    Generation.find({ userId: req.userId, title: rx }).sort({ createdAt: -1 }).limit(6).lean(),
    Artifact.find({ _id: { $in: sharedIds }, title: rx }).limit(6).lean(),
  ]);
  res.json({ artifacts: artifacts.map((a) => artifactDto(a)), generations: generations.map(generationDto), shared: shared.map((a) => artifactDto(a, 'viewer')) });
});
