import { Request, Response } from 'express';
import { z } from 'zod';
import { REPORT_CATEGORIES, Report } from '../models/Report';
import { Message } from '../models/Message';
import { checkFile } from '../middleware/upload';
import { adminEvent } from '../services/notification.service';
import { saveFile } from '../services/storage.service';
import { asyncHandler } from '../utils/asyncHandler';
import { badRequest, notFound } from '../utils/errors';
import { cleanText } from '../utils/sanitize';
import { IMAGE_MIMES } from '../utils/sniff';
import { isAdminOnline } from '../sockets/presence';
import { getSystem } from '../services/settings.service';

export const reportDto = (r: any, user?: any) => ({
  id: String(r._id), category: r.category, subject: r.subject, description: r.description, attachments: r.attachments, status: r.status,
  responses: r.responses, history: r.history, createdAt: r.createdAt, updatedAt: r.updatedAt,
  ...(user ? { user: { id: String(user._id), name: user.name, email: user.email } } : {}),
});

const createSchema = z.object({
  category: z.enum(REPORT_CATEGORIES), subject: z.string().trim().min(4).max(140), description: z.string().trim().min(10).max(4000),
});

export const createReport = asyncHandler(async (req: Request, res: Response) => {
  const b = createSchema.parse(req.body);
  const files = (req.files as Express.Multer.File[] | undefined) || [];
  const attachments = [];
  for (const f of files.slice(0, 3)) {
    const c = checkFile(f, [...IMAGE_MIMES, 'application/pdf'], 'attachment');
    const s = await saveFile(c.buffer, { folder: 'reports', mime: c.mime, ownerId: req.userId! });
    attachments.push({ name: c.filename, url: s.url, mimeType: c.mime });
  }
  const report = await Report.create({
    userId: req.userId, category: b.category, subject: cleanText(b.subject, 140), description: cleanText(b.description, 4000), attachments,
    history: [{ status: 'open', by: 'user', note: 'Report created' }],
  });
  adminEvent('report', { reportId: String(report._id), subject: report.subject, user: req.user.name });
  res.status(201).json({ report: reportDto(report) });
});

export const listReports = asyncHandler(async (req, res) => {
  const items = await Report.find({ userId: req.userId }).sort({ updatedAt: -1 }).limit(100).lean();
  res.json({ items: items.map((r) => reportDto(r)) });
});

export const getReport = asyncHandler(async (req, res) => {
  const r = await Report.findOne({ _id: req.params.id, userId: req.userId }).lean();
  if (!r) throw notFound('Report not found.');
  res.json({ report: reportDto(r) });
});

export const replyReport = asyncHandler(async (req, res) => {
  const { text } = z.object({ text: z.string().trim().min(1).max(2000) }).parse(req.body);
  const r = await Report.findOne({ _id: req.params.id, userId: req.userId });
  if (!r) throw notFound('Report not found.');
  if (r.status === 'closed') throw badRequest('This report is closed. Reopen it to reply.', 'REPORT_CLOSED');
  r.responses.push({ by: 'user', text: cleanText(text, 2000), at: new Date() } as any);
  if (r.status === 'resolved') { r.status = 'reopened'; r.history.push({ status: 'reopened', by: 'user', note: 'User replied', at: new Date() } as any); }
  await r.save();
  adminEvent('report', { reportId: String(r._id), subject: r.subject, user: req.user.name, reply: true });
  res.json({ report: reportDto(r) });
});

export const setReportStatus = asyncHandler(async (req, res) => {
  const { status } = z.object({ status: z.enum(['reopened', 'closed']) }).parse(req.body);
  const r = await Report.findOne({ _id: req.params.id, userId: req.userId });
  if (!r) throw notFound('Report not found.');
  if (status === 'reopened' && !['resolved', 'closed'].includes(r.status)) throw badRequest('Only resolved or closed reports can be reopened.');
  r.status = status;
  r.history.push({ status, by: 'user', note: status === 'closed' ? 'Closed by user' : 'Reopened by user', at: new Date() } as any);
  await r.save();
  adminEvent('report', { reportId: String(r._id), subject: r.subject, user: req.user.name, status });
  res.json({ report: reportDto(r) });
});

export const chatHistory = asyncHandler(async (req, res) => {
  const msgs = await Message.find({ conversationId: req.userId }).sort({ createdAt: -1 }).limit(100).lean();
  const unread = await Message.countDocuments({ conversationId: req.userId, sender: 'admin', readAt: { $exists: false } });
  res.json({
    messages: msgs.reverse().map((m) => ({ id: String(m._id), sender: m.sender, text: m.text, readAt: m.readAt, createdAt: (m as any).createdAt })),
    unread, adminOnline: isAdminOnline(), enabled: (await getSystem()).supportChatEnabled,
  });
});
