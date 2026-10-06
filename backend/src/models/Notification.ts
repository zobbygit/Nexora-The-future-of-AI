import { Schema, model } from 'mongoose';

export const NOTIFICATION_TYPES = [
  'generation', 'file', 'processing', 'download', 'report', 'admin_reply',
  'announcement', 'subscription', 'payment', 'collab_invite', 'collab_update', 'system',
] as const;

const schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true, maxlength: 160 },
    body: { type: String, default: '', maxlength: 1000 },
    link: String,
    read: { type: Boolean, default: false, index: true },
    announcementId: { type: Schema.Types.ObjectId, ref: 'Announcement' },
  },
  { timestamps: true },
);
schema.index({ userId: 1, createdAt: -1 });
schema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export const Notification = model('Notification', schema);
