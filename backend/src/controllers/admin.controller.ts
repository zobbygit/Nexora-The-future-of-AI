import { Request } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { env } from '../config/env';
import { PROVIDERS, PROVIDER_LABEL, TOOLS } from '../config/tools';
import { Announcement } from '../models/Announcement';
import { Artifact } from '../models/Artifact';
import { AuditLog } from '../models/AuditLog';
import { Collaboration } from '../models/Collaboration';
import { CreditTransaction } from '../models/CreditTransaction';
import { Generation } from '../models/Generation';
import { Message } from '../models/Message';
import { Notification } from '../models/Notification';
import { ProviderHealth } from '../models/ProviderHealth';
import { REPORT_STATUSES, Report } from '../models/Report';
import { ErrorLog } from '../models/Setting';
import { Payment, Subscription } from '../models/Subscription';
import { User, publicUser } from '../models/User';
import { generationDto } from '../services/ai.service';
import { audit } from '../services/audit.service';
import { adjustCredits, applyPlanChange } from '../services/credit.service';
import { notify, notifyMany } from '../services/notification.service';
import { renderPdf } from '../services/pdf.service';
import { ADAPTERS } from '../services/providers';
import { getPlans, getSystem, getTools, invalidateSettings, rawSetting, saveSetting } from '../services/settings.service';
import { purgeUserData } from '../services/userPurge.service';
import { isUserOnline } from '../sockets/presence';
import { emitToUser } from '../sockets/io';
import { asyncHandler } from '../utils/asyncHandler';
import { badRequest, notFound } from '../utils/errors';
import { daysAgo, startOfDayUtc } from '../utils/dates';
import { cleanText, escapeRegex } from '../utils/sanitize';
import { reportDto } from './support.controller';
import { stripeConfigured, stripeMode } from '../services/stripe.service';

const oid = (id: string) => { if (!Types.ObjectId.isValid(id)) throw notFound(); return new Types.ObjectId(id); };
const paging = (req: Request, def = 25) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(Number(req.query.limit) || def, 100);
  return { page, limit, skip: (page - 1) * limit };
};
const A = 'Administrator';

// ── Dashboard ────────────────────────────────────────────
const revenueTotal = async (since?: Date) => {
  const r = await Payment.aggregate([{ $match: { status: 'paid', ...(since ? { createdAt: { $gte: since } } : {}) } }, { $group: { _id: null, total: { $sum: '$amount' } } }]);
  return r[0]?.total || 0;
};

export const dashboard = asyncHandler(async (_req, res) => {
  const today = startOfDayUtc();
  const [total, pro, todayGen, credits, failed, openReports, activeSubs, revenue, recent, health, genDaily] = await Promise.all([
    User.countDocuments(), User.countDocuments({ plan: 'pro' }), Generation.countDocuments({ createdAt: { $gte: today } }),
    CreditTransaction.aggregate([{ $match: { type: 'AI_GENERATION', timestamp: { $gte: today } } }, { $group: { _id: null, n: { $sum: { $abs: '$amount' } } } }]),
    Generation.countDocuments({ status: 'failed', createdAt: { $gte: daysAgo(1) } }),
    Report.countDocuments({ status: { $in: ['open', 'in_progress', 'reopened'] } }), Subscription.countDocuments({ status: { $in: ['active', 'trialing'] } }),
    revenueTotal(),
    Generation.find().sort({ createdAt: -1 }).limit(10).populate('userId', 'name').lean(),
    providerStatuses(),
    Generation.aggregate([{ $match: { createdAt: { $gte: daysAgo(13) } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, total: { $sum: 1 }, failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } } } }, { $sort: { _id: 1 } }]),
  ]);
  res.json({
    metrics: {
      totalUsers: total, freeUsers: total - pro, proUsers: pro, todayGenerations: todayGen, creditsConsumed: credits[0]?.n || 0, revenue,
      activeProviders: health.filter((h) => h.status === 'healthy').length, totalProviders: PROVIDERS.length,
      failedRequests: failed, openReports, activeSubscriptions: activeSubs,
    },
    genDaily: fillDays(genDaily, 14, { total: 0, failed: 0 }),
    recent: recent.map((g: any) => ({ ...generationDto(g), user: g.userId?.name || 'Deleted user' })),
    providers: health,
  });
});

const fillDays = (rows: any[], n: number, zero: Record<string, number>) => {
  const map = new Map(rows.map((r) => [r._id, r]));
  return Array.from({ length: n }, (_, i) => {
    const d = daysAgo(n - 1 - i).toISOString().slice(0, 10);
    return { date: d, ...zero, ...(map.get(d) ? Object.fromEntries(Object.entries(map.get(d)).filter(([k]) => k !== '_id')) : {}) };
  });
};

// ── Users ────────────────────────────────────────────────
export const listUsers = asyncHandler(async (req, res) => {
  const { q, plan, status } = req.query as Record<string, string>;
  const { page, limit, skip } = paging(req);
  const filter: any = {};
  if (plan === 'free' || plan === 'pro') filter.plan = plan;
  if (status === 'active') filter.isActive = true;
  if (status === 'inactive') filter.isActive = false;
  if (q) { const rx = new RegExp(escapeRegex(String(q).slice(0, 80)), 'i'); filter.$or = [{ name: rx }, { email: rx }, { phone: rx }]; }
  const [items, total] = await Promise.all([User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), User.countDocuments(filter)]);
  res.json({ items: items.map((u) => ({ ...publicUser(u), lastActiveAt: u.lastActiveAt, online: isUserOnline(String(u._id)) })), total, page, pages: Math.ceil(total / limit) });
});

export const userDetail = asyncHandler(async (req, res) => {
  const id = oid(req.params.id);
  const user = await User.findById(id).lean();
  if (!user) throw notFound('User not found.');
  const [gens, usage, subs, reports, collab, tx, artifacts, payments] = await Promise.all([
    Generation.find({ userId: id }).select('-input -output').sort({ createdAt: -1 }).limit(20).lean(),
    Generation.aggregate([{ $match: { userId: id } }, { $group: { _id: '$tool', count: { $sum: 1 }, credits: { $sum: '$creditsUsed' }, failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } } } }, { $sort: { count: -1 } }]),
    Subscription.find({ userId: id }).sort({ createdAt: -1 }).lean(), Report.find({ userId: id }).sort({ createdAt: -1 }).limit(20).lean(),
    Collaboration.find({ $or: [{ ownerId: id }, { collaboratorId: id }] }).limit(20).populate('artifactId', 'title').populate('ownerId collaboratorId', 'name').lean(),
    CreditTransaction.find({ userId: id }).sort({ timestamp: -1 }).limit(20).lean(), Artifact.countDocuments({ ownerId: id }),
    Payment.find({ userId: id }).sort({ createdAt: -1 }).limit(10).lean(),
  ]);
  res.json({
    user: { ...publicUser(user), lastActiveAt: user.lastActiveAt, stripeCustomerId: user.stripeCustomerId, online: isUserOnline(String(id)), reservedCredits: user.reservedCredits },
    generations: gens.map(generationDto), usage: usage.map((u) => ({ tool: u._id, count: u.count, credits: u.credits, failed: u.failed })),
    subscriptions: subs.map((s: any) => ({ id: String(s._id), status: s.status, cancelAtPeriodEnd: s.cancelAtPeriodEnd, currentPeriodEnd: s.currentPeriodEnd, createdAt: s.createdAt })),
    payments: payments.map((p: any) => ({ id: String(p._id), amount: p.amount, status: p.status, createdAt: p.createdAt })),
    reports: reports.map((r) => reportDto(r)),
    collaboration: collab.map((c: any) => ({ id: String(c._id), permission: c.permission, artifact: c.artifactId?.title, owner: c.ownerId?.name, collaborator: c.collaboratorId?.name })),
    transactions: tx.map((t) => ({ id: String(t._id), type: t.type, amount: t.amount, balanceAfter: t.balanceAfter, reason: t.reason, timestamp: t.timestamp })),
    artifactCount: artifacts,
  });
});

export const setUserActive = asyncHandler(async (req, res) => {
  const { active } = z.object({ active: z.boolean() }).parse(req.body);
  const user = await User.findByIdAndUpdate(oid(req.params.id), { isActive: active, $inc: { tokenVersion: active ? 0 : 1 } }, { new: true });
  if (!user) throw notFound('User not found.');
  await audit(A, active ? 'user.activated' : 'user.deactivated', String(user._id), { email: user.email });
  res.json({ user: publicUser(user) });
});

export const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(oid(req.params.id));
  if (!user) throw notFound('User not found.');
  await purgeUserData(String(user._id));
  await audit(A, 'user.deleted', String(user._id), { email: user.email });
  res.json({ ok: true });
});

export const userCredits = asyncHandler(async (req, res) => {
  const b = z.object({ delta: z.number().int().min(-100000).max(100000).refine((n) => n !== 0, 'Enter a non-zero amount'), reason: z.string().trim().min(3).max(200) }).parse(req.body);
  const after = await adjustCredits(req.params.id, b.delta, `Admin: ${b.reason}`);
  await audit(A, 'credits.modified', req.params.id, { delta: b.delta, reason: b.reason, balanceAfter: after });
  void notify(req.params.id, 'system', 'Credits updated', `${b.delta > 0 ? '+' : ''}${b.delta} credits: ${b.reason}`, '/app/billing');
  emitToUser(req.params.id, 'credits:update', { credits: after });
  res.json({ credits: after });
});

export const userPlan = asyncHandler(async (req, res) => {
  const { plan } = z.object({ plan: z.enum(['free', 'pro']) }).parse(req.body);
  const user = await User.findById(oid(req.params.id));
  if (!user) throw notFound('User not found.');
  if (user.plan !== plan) {
    await applyPlanChange(String(user._id), plan, `Admin changed plan to ${plan}`);
    await audit(A, 'plan.changed', String(user._id), { from: user.plan, to: plan });
    void notify(user._id, 'subscription', `Your plan is now ${plan === 'pro' ? 'Pro' : 'Free'}`, 'An administrator updated your plan.', '/app/billing');
  }
  res.json({ user: publicUser(await User.findById(user._id)) });
});

// ── AI management ────────────────────────────────────────
const providerStatuses = async () => {
  const rows = await ProviderHealth.find().lean();
  const byName = new Map(rows.map((r) => [r.provider, r]));
  return PROVIDERS.map((p) => {
    const r: any = byName.get(p);
    const configured = env.AI_MOCK || ADAPTERS[p].isConfigured();
    const requests = r?.requests || 0, failures = r?.failures || 0;
    const rate = requests ? failures / requests : 0;
    let status: 'healthy' | 'degraded' | 'unavailable' = 'healthy';
    if (!configured || (r?.consecutiveFailures || 0) >= 3) status = 'unavailable';
    else if ((r?.consecutiveFailures || 0) >= 1 || (requests >= 5 && rate > 0.2)) status = 'degraded';
    return {
      provider: p, label: PROVIDER_LABEL[p], configured, status, requests, successes: r?.successes || 0, failures,
      successRate: requests ? Math.round((1 - rate) * 1000) / 10 : null, avgLatencyMs: r?.successes ? Math.round(r.totalLatencyMs / r.successes) : null,
      fallbacksFrom: r?.fallbacksFrom || 0, lastError: r?.lastError, lastErrorAt: r?.lastErrorAt, lastSuccessAt: r?.lastSuccessAt, lastModel: r?.lastModel,
    };
  });
};

export const aiOverview = asyncHandler(async (_req, res) => {
  const [providers, tools, totals, fallback, errors] = await Promise.all([
    providerStatuses(),
    Generation.aggregate([{ $group: { _id: '$tool', count: { $sum: 1 }, failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } }, credits: { $sum: '$creditsUsed' }, avgLatency: { $avg: '$latency' } } }, { $sort: { count: -1 } }]),
    Generation.aggregate([{ $group: { _id: null, total: { $sum: 1 }, failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } }, fallback: { $sum: { $cond: ['$fallbackUsed', 1, 0] } } } }]),
    Generation.countDocuments({ fallbackUsed: true }),
    Generation.find({ status: 'failed' }).select('-input -output').sort({ createdAt: -1 }).limit(15).populate('userId', 'name').lean(),
  ]);
  res.json({
    providers, mock: env.AI_MOCK,
    tools: tools.map((t) => ({ tool: t._id, count: t.count, failed: t.failed, credits: t.credits, avgLatencyMs: Math.round(t.avgLatency || 0) })),
    totals: { generations: totals[0]?.total || 0, failed: totals[0]?.failed || 0, fallbackEvents: fallback },
    errors: errors.map((g: any) => ({ ...generationDto(g), user: g.userId?.name })),
  });
});

export const listGenerations = asyncHandler(async (req, res) => {
  const { q, tool, status, provider, fallback } = req.query as Record<string, string>;
  const { page, limit, skip } = paging(req);
  const filter: any = {};
  if (tool) filter.tool = String(tool);
  if (status === 'completed' || status === 'failed') filter.status = status;
  if (provider) filter.provider = String(provider);
  if (fallback === 'true') filter.fallbackUsed = true;
  if (q) filter.title = new RegExp(escapeRegex(String(q).slice(0, 80)), 'i');
  const [items, total] = await Promise.all([Generation.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('userId', 'name email').lean(), Generation.countDocuments(filter)]);
  res.json({ items: items.map((g: any) => ({ ...generationDto(g), attempts: g.attempts, user: g.userId ? { id: String(g.userId._id), name: g.userId.name, email: g.userId.email } : null })), total, page, pages: Math.ceil(total / limit) });
});

export const getGeneration = asyncHandler(async (req, res) => {
  const g: any = await Generation.findById(oid(req.params.id)).populate('userId', 'name email').lean();
  if (!g) throw notFound('Generation not found.');
  res.json({ generation: { ...generationDto(g), attempts: g.attempts, user: g.userId ? { name: g.userId.name, email: g.userId.email } : null } });
});

// ── Billing ──────────────────────────────────────────────
export const billingOverview = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paging(req);
  const [payments, total, active, cancelled, pro, revenue, month, subs] = await Promise.all([
    Payment.find().sort({ createdAt: -1 }).skip(skip).limit(limit).populate('userId', 'name email').lean(), Payment.countDocuments(),
    Subscription.countDocuments({ status: { $in: ['active', 'trialing'] } }), Subscription.countDocuments({ status: 'canceled' }),
    User.countDocuments({ plan: 'pro' }), revenueTotal(), revenueTotal(daysAgo(30)),
    Subscription.find().sort({ updatedAt: -1 }).limit(25).populate('userId', 'name email').lean(),
  ]);
  res.json({
    stripe: { enabled: stripeConfigured(), mode: stripeMode() },
    metrics: { activeSubscriptions: active, cancelledSubscriptions: cancelled, proUsers: pro, revenue, revenueLast30: month },
    payments: payments.map((p: any) => ({ id: String(p._id), amount: p.amount, currency: p.currency, status: p.status, description: p.description, createdAt: p.createdAt, user: p.userId ? { id: String(p.userId._id), name: p.userId.name, email: p.userId.email } : null })),
    subscriptions: subs.map((s: any) => ({ id: String(s._id), status: s.status, cancelAtPeriodEnd: s.cancelAtPeriodEnd, currentPeriodEnd: s.currentPeriodEnd, createdAt: s.createdAt, history: s.history, user: s.userId ? { id: String(s.userId._id), name: s.userId.name, email: s.userId.email } : null })),
    total, page, pages: Math.ceil(total / limit),
  });
});

// ── Plans & credits ──────────────────────────────────────
export const getPlansConfig = asyncHandler(async (_req, res) => {
  const [plans, tools] = await Promise.all([getPlans(), getTools()]);
  res.json({ plans, tools: tools.map((t) => ({ id: t.id, name: t.name, category: t.category, plan: t.plan, credits: t.credits, enabled: t.enabled, defaultCredits: TOOLS.find((d) => d.id === t.id)!.credits, defaultPlan: TOOLS.find((d) => d.id === t.id)!.plan })) });
});

export const updatePlansConfig = asyncHandler(async (req, res) => {
  const b = z.object({
    plans: z.object({ free: z.object({ creditsPerPeriod: z.number().int().min(0).max(1_000_000) }), pro: z.object({ creditsPerPeriod: z.number().int().min(0).max(1_000_000) }) }).optional(),
    tools: z.record(z.string(), z.object({ credits: z.number().int().min(0).max(1000).optional(), plan: z.enum(['free', 'pro']).optional(), enabled: z.boolean().optional() })).optional(),
  }).parse(req.body);
  if (b.plans) { const cur: any = (await rawSetting('plans')) || {}; await saveSetting('plans', { free: { ...cur.free, ...b.plans.free }, pro: { ...cur.pro, ...b.plans.pro } }); }
  if (b.tools) {
    const valid = new Set(TOOLS.map((t) => t.id as string));
    const cur: any = (await rawSetting('tools')) || {};
    for (const [id, v] of Object.entries(b.tools)) { if (!valid.has(id)) throw badRequest(`Unknown tool ${id}`); cur[id] = { ...cur[id], ...v }; }
    await saveSetting('tools', cur);
  }
  invalidateSettings();
  await audit(A, 'plans.updated', undefined, b as any);
  res.json({ plans: await getPlans(), tools: await getTools() });
});

// ── Support ──────────────────────────────────────────────
export const listReports = asyncHandler(async (req, res) => {
  const { q, status, category } = req.query as Record<string, string>;
  const { page, limit, skip } = paging(req);
  const filter: any = {};
  if (status && (REPORT_STATUSES as readonly string[]).includes(status)) filter.status = status;
  if (category) filter.category = String(category);
  if (q) filter.subject = new RegExp(escapeRegex(String(q).slice(0, 80)), 'i');
  const [items, total, counts] = await Promise.all([
    Report.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).populate('userId', 'name email').lean(), Report.countDocuments(filter),
    Report.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
  ]);
  res.json({ items: items.map((r: any) => reportDto(r, r.userId)), total, page, pages: Math.ceil(total / limit), counts: Object.fromEntries(counts.map((c) => [c._id, c.n])) });
});

export const getReport = asyncHandler(async (req, res) => {
  const r: any = await Report.findById(oid(req.params.id)).populate('userId', 'name email').lean();
  if (!r) throw notFound('Report not found.');
  res.json({ report: reportDto(r, r.userId) });
});

export const replyReport = asyncHandler(async (req, res) => {
  const b = z.object({ text: z.string().trim().min(1).max(2000), status: z.enum(['in_progress', 'resolved']).optional() }).parse(req.body);
  const r = await Report.findById(oid(req.params.id));
  if (!r) throw notFound('Report not found.');
  r.responses.push({ by: 'admin', text: cleanText(b.text, 2000), at: new Date() } as any);
  const next = b.status || (r.status === 'open' || r.status === 'reopened' ? 'in_progress' : r.status);
  if (next !== r.status) { r.status = next as any; r.history.push({ status: next, by: 'admin', note: b.status === 'resolved' ? 'Resolved with reply' : 'Admin replied', at: new Date() } as any); }
  await r.save();
  await audit(A, b.status === 'resolved' ? 'report.resolved' : 'report.replied', String(r._id));
  void notify(r.userId, 'report', 'New reply to your report', r.subject, '/app/support?tab=reports');
  void notify(r.userId, 'admin_reply', 'Support replied', b.text.slice(0, 120), '/app/support?tab=reports');
  res.json({ report: reportDto(r) });
});

export const setReportStatus = asyncHandler(async (req, res) => {
  const { status, note } = z.object({ status: z.enum(REPORT_STATUSES), note: z.string().max(200).optional() }).parse(req.body);
  const r = await Report.findById(oid(req.params.id));
  if (!r) throw notFound('Report not found.');
  r.status = status;
  r.history.push({ status, by: 'admin', note: note || `Marked ${status.replace('_', ' ')}`, at: new Date() } as any);
  await r.save();
  await audit(A, `report.${status}`, String(r._id));
  void notify(r.userId, 'report', 'Report status updated', `“${r.subject}” is now ${status.replace('_', ' ')}.`, '/app/support?tab=reports');
  res.json({ report: reportDto(r) });
});

export const conversations = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  const rows = await Message.aggregate([
    { $sort: { createdAt: -1 } },
    { $group: { _id: '$conversationId', last: { $first: '$$ROOT' }, unread: { $sum: { $cond: [{ $and: [{ $eq: ['$sender', 'user'] }, { $not: ['$readAt'] }] }, 1, 0] } } } },
    { $sort: { 'last.createdAt': -1 } }, { $limit: 100 },
  ]);
  const users = await User.find({ _id: { $in: rows.map((r) => r._id) } }).select('name email avatarUrl').lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));
  let items = rows.map((r) => { const u: any = byId.get(String(r._id)); return { userId: String(r._id), name: u?.name || 'Deleted user', email: u?.email, avatarUrl: u?.avatarUrl, lastMessage: r.last.text, lastAt: r.last.createdAt, lastSender: r.last.sender, unread: r.unread, online: isUserOnline(String(r._id)) }; });
  if (q) items = items.filter((i) => `${i.name} ${i.email}`.toLowerCase().includes(q.toLowerCase()));
  res.json({ items, totalUnread: items.reduce((a, i) => a + i.unread, 0) });
});

export const conversationMessages = asyncHandler(async (req, res) => {
  const id = oid(req.params.userId);
  const [user, msgs] = await Promise.all([User.findById(id).select('name email avatarUrl plan').lean(), Message.find({ conversationId: id }).sort({ createdAt: -1 }).limit(200).lean()]);
  if (!user) throw notFound('User not found.');
  res.json({ user: { id: String(id), name: user.name, email: user.email, avatarUrl: user.avatarUrl, plan: user.plan, online: isUserOnline(String(id)) }, messages: msgs.reverse().map((m) => ({ id: String(m._id), sender: m.sender, text: m.text, readAt: m.readAt, createdAt: (m as any).createdAt })) });
});

export const chatUsers = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 60);
  if (q.length < 2) return res.json({ users: [] });
  const rx = new RegExp(escapeRegex(q), 'i');
  const users = await User.find({ $or: [{ name: rx }, { email: rx }] }).select('name email avatarUrl').limit(8).lean();
  res.json({ users: users.map((u) => ({ id: String(u._id), name: u.name, email: u.email, avatarUrl: u.avatarUrl, online: isUserOnline(String(u._id)) })) });
});

// ── Communication ────────────────────────────────────────
const announcementSchema = z.object({
  title: z.string().trim().min(3).max(120), message: z.string().trim().min(3).max(1000),
  audience: z.enum(['all', 'free', 'pro', 'selected']).default('all'),
  userIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).max(500).default([]), scheduledFor: z.string().datetime().optional(),
});

export const dispatchAnnouncement = async (id: Types.ObjectId | string) => {
  const a = await Announcement.findOneAndUpdate({ _id: id, status: 'scheduled' }, { status: 'sent', sentAt: new Date() }, { new: true });
  if (!a) return 0;
  const filter: any = { isActive: true };
  if (a.audience === 'free') filter.plan = 'free';
  if (a.audience === 'pro') filter.plan = 'pro';
  if (a.audience === 'selected') filter._id = { $in: a.userIds };
  const ids = (await User.find(filter).select('_id').lean()).map((u) => u._id);
  const n = await notifyMany(ids, 'announcement', a.title, a.message, { announcementId: a._id, link: '/app/notifications' });
  a.recipientCount = n;
  await a.save();
  return n;
};

export const listAnnouncements = asyncHandler(async (_req, res) => {
  const items = await Announcement.find().sort({ createdAt: -1 }).limit(100).lean();
  res.json({ items: items.map((a) => ({ id: String(a._id), title: a.title, message: a.message, audience: a.audience, status: a.status, scheduledFor: a.scheduledFor, sentAt: a.sentAt, recipientCount: a.recipientCount, createdAt: (a as any).createdAt })) });
});

export const createAnnouncement = asyncHandler(async (req, res) => {
  const b = announcementSchema.parse(req.body);
  if (b.audience === 'selected' && !b.userIds.length) throw badRequest('Choose at least one recipient.');
  const when = b.scheduledFor ? new Date(b.scheduledFor) : undefined;
  const scheduled = !!when && when.getTime() > Date.now() + 5000;
  const a = await Announcement.create({ title: cleanText(b.title, 120), message: cleanText(b.message, 1000), audience: b.audience, userIds: b.userIds, status: 'scheduled', scheduledFor: scheduled ? when : undefined });
  if (!scheduled) await dispatchAnnouncement(a._id);
  await audit(A, 'announcement.created', String(a._id), { audience: b.audience, scheduled });
  res.status(201).json({ announcement: await Announcement.findById(a._id).lean() });
});

export const updateAnnouncement = asyncHandler(async (req, res) => {
  const b = announcementSchema.partial().parse(req.body);
  const a = await Announcement.findById(oid(req.params.id));
  if (!a) throw notFound('Announcement not found.');
  if (a.status === 'sent') {
    // Already delivered: update the record and the in-app notifications it created.
    if (b.title) a.title = cleanText(b.title, 120);
    if (b.message) a.message = cleanText(b.message, 1000);
    await Notification.updateMany({ announcementId: a._id }, { title: a.title, body: a.message });
  } else {
    if (b.title) a.title = cleanText(b.title, 120);
    if (b.message) a.message = cleanText(b.message, 1000);
    if (b.audience) a.audience = b.audience;
    if (b.userIds) a.userIds = b.userIds as any;
    if (b.scheduledFor) a.scheduledFor = new Date(b.scheduledFor);
  }
  await a.save();
  await audit(A, 'announcement.updated', String(a._id));
  res.json({ announcement: a });
});

export const deleteAnnouncement = asyncHandler(async (req, res) => {
  const a = await Announcement.findById(oid(req.params.id));
  if (!a) throw notFound('Announcement not found.');
  await Notification.deleteMany({ announcementId: a._id });
  await a.deleteOne();
  await audit(A, 'announcement.deleted', String(a._id), { title: a.title });
  res.json({ ok: true });
});

export const notificationStats = asyncHandler(async (_req, res) => {
  const rows = await Notification.aggregate([{ $match: { createdAt: { $gte: daysAgo(30) } } }, { $group: { _id: '$type', total: { $sum: 1 }, unread: { $sum: { $cond: ['$read', 0, 1] } } } }, { $sort: { total: -1 } }]);
  res.json({ groups: rows.map((r) => ({ type: r._id, total: r.total, unread: r.unread })) });
});

export const sendSystemNotification = asyncHandler(async (req, res) => {
  const b = z.object({ userId: z.string().regex(/^[a-f\d]{24}$/i), title: z.string().trim().min(3).max(120), body: z.string().trim().max(500).default('') }).parse(req.body);
  if (!(await User.exists({ _id: b.userId }))) throw notFound('User not found.');
  await notify(b.userId, 'system', b.title, b.body);
  await audit(A, 'notification.sent', b.userId, { title: b.title });
  res.status(201).json({ ok: true });
});

// ── Analytics ────────────────────────────────────────────
export const analytics = asyncHandler(async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 30, 7), 90);
  const since = daysAgo(days - 1);
  const day = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
  const [signups, byPlan, active, daily, tools, providers, credits, status, revenueDaily, subGrowth, conv, payStatus, totalUsers] = await Promise.all([
    User.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: day, n: { $sum: 1 } } }]),
    User.aggregate([{ $group: { _id: '$plan', n: { $sum: 1 } } }]),
    Generation.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: { d: day, u: '$userId' } } }, { $group: { _id: '$_id.d', n: { $sum: 1 } } }]),
    Generation.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: day, total: { $sum: 1 }, failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } }, fallback: { $sum: { $cond: ['$fallbackUsed', 1, 0] } } } }]),
    Generation.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: '$tool', n: { $sum: 1 } } }, { $sort: { n: -1 } }]),
    Generation.aggregate([{ $match: { createdAt: { $gte: since }, provider: { $exists: true } } }, { $group: { _id: '$provider', n: { $sum: 1 } } }, { $sort: { n: -1 } }]),
    CreditTransaction.aggregate([{ $match: { type: 'AI_GENERATION', timestamp: { $gte: since } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }, n: { $sum: { $abs: '$amount' } } } }]),
    Generation.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    Payment.aggregate([{ $match: { status: 'paid', createdAt: { $gte: since } } }, { $group: { _id: day, n: { $sum: '$amount' } } }]),
    Subscription.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: day, n: { $sum: 1 } } }]),
    Subscription.distinct('userId'), Payment.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]), User.countDocuments(),
  ]);
  const series = (rows: any[], key = 'n') => fillDays(rows.map((r) => ({ _id: r._id, [key]: r[key] ?? r.n })), days, { [key]: 0 });
  const g = daily.reduce((a, r) => ({ total: a.total + r.total, failed: a.failed + r.failed, fallback: a.fallback + r.fallback }), { total: 0, failed: 0, fallback: 0 });
  res.json({
    days,
    users: { growth: series(signups, 'registrations'), active: series(active, 'active'), plan: byPlan.map((p) => ({ plan: p._id, count: p.n })), registrations: signups.reduce((a, r) => a + r.n, 0) },
    ai: {
      daily: fillDays(daily, days, { total: 0, failed: 0, fallback: 0 }), tools: tools.map((t) => ({ tool: t._id, count: t.n })), providers: providers.map((p) => ({ provider: p._id, count: p.n })),
      credits: series(credits, 'credits'), status: status.map((s) => ({ status: s._id, count: s.n })),
      successRate: g.total ? Math.round(((g.total - g.failed) / g.total) * 1000) / 10 : null, fallbackRate: g.total ? Math.round((g.fallback / g.total) * 1000) / 10 : null, totalGenerations: g.total,
    },
    revenue: { daily: series(revenueDaily, 'revenue'), total: revenueDaily.reduce((a, r) => a + r.n, 0), conversions: conv.length, conversionRate: totalUsers ? Math.round((conv.length / totalUsers) * 1000) / 10 : 0, subscriptionGrowth: series(subGrowth, 'subscriptions'), paymentStatus: payStatus.map((p) => ({ status: p._id, count: p.n })) },
  });
});

export const analyticsPdf = asyncHandler(async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 30, 7), 90);
  const since = daysAgo(days - 1);
  const [users, gens, failed, revenue, tools] = await Promise.all([
    User.countDocuments({ createdAt: { $gte: since } }), Generation.countDocuments({ createdAt: { $gte: since } }), Generation.countDocuments({ createdAt: { $gte: since }, status: 'failed' }),
    revenueTotal(since), Generation.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: '$tool', n: { $sum: 1 } } }, { $sort: { n: -1 } }]),
  ]);
  const pdf = await renderPdf(`Nexora analytics — last ${days} days`, [
    { heading: 'Overview', body: `New users: ${users}\nGenerations: ${gens} (${failed} failed)\nRevenue: ₹${revenue}` },
    { heading: 'Tool popularity', table: { head: ['Tool', 'Generations'], rows: tools.map((t) => [t._id, String(t.n)]) } },
  ], new Date().toDateString());
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="nexora-analytics.pdf"');
  res.send(pdf);
});

// ── System ───────────────────────────────────────────────
export const systemOverview = asyncHandler(async (_req, res) => {
  const [providers, errors, system, recentGens, recentUsers, recentPayments] = await Promise.all([
    providerStatuses(), ErrorLog.find().sort({ timestamp: -1 }).limit(30).lean(), getSystem(),
    Generation.find().select('tool status createdAt userId').sort({ createdAt: -1 }).limit(12).populate('userId', 'name').lean(),
    User.find().select('name createdAt').sort({ createdAt: -1 }).limit(8).lean(), Payment.find().sort({ createdAt: -1 }).limit(6).lean(),
  ]);
  const activity = [
    ...recentGens.map((g: any) => ({ at: g.createdAt, kind: 'generation', text: `${g.userId?.name || 'A user'} ${g.status === 'failed' ? 'hit an error with' : 'used'} ${g.tool}` })),
    ...recentUsers.map((u: any) => ({ at: (u as any).createdAt, kind: 'signup', text: `${u.name} joined Nexora` })),
    ...recentPayments.map((p: any) => ({ at: p.createdAt, kind: 'payment', text: `Payment ${p.status}: ₹${p.amount}` })),
  ].sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 25);
  res.json({
    providers, settings: system, activity, uptimeSeconds: Math.round(process.uptime()), node: process.version, env: env.NODE_ENV, mock: env.AI_MOCK,
    stripe: { enabled: stripeConfigured(), mode: stripeMode() },
    errors: errors.map((e: any) => ({ id: String(e._id), status: e.status, code: e.code, message: e.message, path: e.path, method: e.method, timestamp: e.timestamp })),
  });
});

export const updateSystem = asyncHandler(async (req, res) => {
  const b = z.object({ registrationEnabled: z.boolean().optional(), maintenanceMode: z.boolean().optional(), supportChatEnabled: z.boolean().optional() }).parse(req.body);
  const cur = await getSystem();
  await saveSetting('system', { ...cur, ...b });
  await audit(A, 'system.setting_changed', undefined, b);
  res.json({ settings: await getSystem() });
});

export const auditLogs = asyncHandler(async (req, res) => {
  const { q, action } = req.query as Record<string, string>;
  const { page, limit, skip } = paging(req, 30);
  const filter: any = {};
  if (action) filter.action = new RegExp(`^${escapeRegex(String(action).slice(0, 40))}`);
  if (q) { const rx = new RegExp(escapeRegex(String(q).slice(0, 80)), 'i'); filter.$or = [{ action: rx }, { target: rx }]; }
  const [items, total] = await Promise.all([AuditLog.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(), AuditLog.countDocuments(filter)]);
  res.json({ items: items.map((l) => ({ id: String(l._id), admin: l.admin, action: l.action, target: l.target, metadata: l.metadata, timestamp: l.timestamp })), total, page, pages: Math.ceil(total / limit) });
});

export const exportAudit = asyncHandler(async (req, res) => {
  const logs = await AuditLog.find().sort({ timestamp: -1 }).limit(2000).lean();
  if (req.params.format === 'json') {
    res.setHeader('Content-Disposition', 'attachment; filename="nexora-audit.json"');
    return res.json({ exportedAt: new Date().toISOString(), count: logs.length, logs: logs.map((l) => ({ admin: l.admin, action: l.action, target: l.target, metadata: l.metadata, timestamp: l.timestamp })) });
  }
  const pdf = await renderPdf('Admin audit log', [{ table: { head: ['Time', 'Admin', 'Action', 'Target', 'Details'], rows: logs.map((l) => [new Date(l.timestamp as any).toISOString().replace('T', ' ').slice(0, 16), l.admin, l.action, l.target || '—', l.metadata ? JSON.stringify(l.metadata).slice(0, 60) : '']) } }], `${logs.length} entries · ${new Date().toDateString()}`);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="nexora-audit.pdf"');
  res.send(pdf);
});

export const transactions = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paging(req, 30);
  const filter: any = {};
  if (req.query.type) filter.type = String(req.query.type);
  if (req.query.userId && Types.ObjectId.isValid(String(req.query.userId))) filter.userId = String(req.query.userId);
  const [items, total] = await Promise.all([CreditTransaction.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit).populate('userId', 'name email').lean(), CreditTransaction.countDocuments(filter)]);
  res.json({ items: items.map((t: any) => ({ id: String(t._id), type: t.type, amount: t.amount, balanceBefore: t.balanceBefore, balanceAfter: t.balanceAfter, reason: t.reason, tool: t.tool, timestamp: t.timestamp, user: t.userId ? { id: String(t.userId._id), name: t.userId.name } : null })), total, page, pages: Math.ceil(total / limit) });
});

/** Global admin search across users, generations, reports, audit logs and transactions. */
export const globalSearch = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 80);
  if (q.length < 2) return res.json({ users: [], generations: [], reports: [], audit: [], transactions: [] });
  const rx = new RegExp(escapeRegex(q), 'i');
  const [users, generations, reports, logs, tx] = await Promise.all([
    User.find({ $or: [{ name: rx }, { email: rx }] }).limit(5).lean(),
    Generation.find({ $or: [{ title: rx }, { tool: rx }] }).select('tool title status createdAt').sort({ createdAt: -1 }).limit(5).lean(),
    Report.find({ subject: rx }).limit(5).lean(), AuditLog.find({ $or: [{ action: rx }, { target: rx }] }).sort({ timestamp: -1 }).limit(5).lean(),
    CreditTransaction.find({ reason: rx }).sort({ timestamp: -1 }).limit(5).lean(),
  ]);
  res.json({
    users: users.map((u) => ({ id: String(u._id), name: u.name, email: u.email, plan: u.plan })),
    generations: generations.map((g) => ({ id: String(g._id), tool: g.tool, title: g.title, status: g.status })),
    reports: reports.map((r) => ({ id: String(r._id), subject: r.subject, status: r.status })),
    audit: logs.map((l) => ({ id: String(l._id), action: l.action, target: l.target })),
    transactions: tx.map((t) => ({ id: String(t._id), type: t.type, reason: t.reason, amount: t.amount })),
  });
});
