import { Schema, model } from 'mongoose';

export const TX_TYPES = ['DAILY_RESET', 'MONTHLY_GRANT', 'AI_GENERATION', 'ADMIN_ADJUSTMENT', 'REFUND'] as const;

const schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: TX_TYPES, required: true, index: true },
    amount: { type: Number, required: true },
    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    reason: { type: String, default: '' },
    tool: String,
    generationId: { type: Schema.Types.ObjectId, ref: 'Generation' },
  },
  { timestamps: { createdAt: 'timestamp', updatedAt: false } },
);
schema.index({ userId: 1, timestamp: -1 });

export const CreditTransaction = model('CreditTransaction', schema);
