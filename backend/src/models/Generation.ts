import { Schema, model, Types } from 'mongoose';

const attemptSchema = new Schema(
  { provider: String, model: String, ok: Boolean, latencyMs: Number, error: String },
  { _id: false },
);

const generationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tool: { type: String, required: true, index: true },
    title: { type: String, default: '' },
    input: { type: Schema.Types.Mixed },
    output: { type: Schema.Types.Mixed },
    provider: { type: String, index: true },
    model: String,
    status: { type: String, enum: ['completed', 'failed'], required: true, index: true },
    creditsUsed: { type: Number, default: 0 },
    artifactId: { type: Schema.Types.ObjectId, ref: 'Artifact' },
    latency: Number,
    error: String,
    fallbackUsed: { type: Boolean, default: false },
    attempts: { type: [attemptSchema], default: [] },
    favorite: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
generationSchema.index({ userId: 1, createdAt: -1 });
generationSchema.index({ createdAt: -1 });

export const Generation = model('Generation', generationSchema);
export type GenerationId = Types.ObjectId;
