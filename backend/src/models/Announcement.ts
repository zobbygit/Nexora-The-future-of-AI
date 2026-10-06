import { Schema, model } from 'mongoose';

const schema = new Schema(
  {
    title: { type: String, required: true, maxlength: 120 },
    message: { type: String, required: true, maxlength: 1000 },
    audience: { type: String, enum: ['all', 'free', 'pro', 'selected'], default: 'all' },
    userIds: { type: [Schema.Types.ObjectId], default: [] },
    status: { type: String, enum: ['scheduled', 'sent'], default: 'sent', index: true },
    scheduledFor: Date,
    sentAt: Date,
    recipientCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const Announcement = model('Announcement', schema);
