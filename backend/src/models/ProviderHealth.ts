import { Schema, model } from 'mongoose';

const schema = new Schema(
  {
    provider: { type: String, required: true, unique: true },
    requests: { type: Number, default: 0 },
    successes: { type: Number, default: 0 },
    failures: { type: Number, default: 0 },
    fallbacksFrom: { type: Number, default: 0 },
    totalLatencyMs: { type: Number, default: 0 },
    consecutiveFailures: { type: Number, default: 0 },
    lastModel: String,
    lastError: String,
    lastErrorAt: Date,
    lastSuccessAt: Date,
  },
  { timestamps: true },
);

export const ProviderHealth = model('ProviderHealth', schema);
