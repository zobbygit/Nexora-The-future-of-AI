import { Schema, model } from 'mongoose';

const schema = new Schema(
  {
    admin: { type: String, required: true },
    action: { type: String, required: true, index: true },
    target: String,
    metadata: Schema.Types.Mixed,
  },
  { timestamps: { createdAt: 'timestamp', updatedAt: false } },
);
schema.index({ timestamp: -1 });

export const AuditLog = model('AuditLog', schema);
