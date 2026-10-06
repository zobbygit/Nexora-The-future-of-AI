import { Schema, model } from 'mongoose';

export const REPORT_STATUSES = ['open', 'in_progress', 'resolved', 'reopened', 'closed'] as const;
export const REPORT_CATEGORIES = ['bug', 'billing', 'account', 'ai_quality', 'feature_request', 'other'] as const;

const schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    category: { type: String, enum: REPORT_CATEGORIES, required: true },
    subject: { type: String, required: true, maxlength: 140 },
    description: { type: String, required: true, maxlength: 4000 },
    attachments: { type: [{ name: String, url: String, mimeType: String }], default: [] },
    status: { type: String, enum: REPORT_STATUSES, default: 'open', index: true },
    responses: {
      type: [{ by: { type: String, enum: ['user', 'admin'] }, text: String, at: { type: Date, default: Date.now } }],
      default: [],
    },
    history: {
      type: [{ status: String, by: String, note: String, at: { type: Date, default: Date.now } }],
      default: [],
    },
  },
  { timestamps: true },
);
schema.index({ status: 1, updatedAt: -1 });

export const Report = model('Report', schema);
