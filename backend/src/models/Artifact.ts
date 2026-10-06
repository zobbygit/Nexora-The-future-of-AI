import { Schema, model } from 'mongoose';

const artifactSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, maxlength: 200 },
    kind: {
      type: String,
      enum: ['text', 'pdf', 'image', 'audio', 'video', 'code', 'resume', 'data', 'response', 'file'],
      required: true,
      index: true,
    },
    tool: { type: String, index: true },
    generationId: { type: Schema.Types.ObjectId, ref: 'Generation' },
    mimeType: String,
    /** Text-like artifacts keep content here; binary artifacts keep only a storage reference. */
    content: { type: String, maxlength: 500000 },
    url: String,
    storage: { provider: String, key: String },
    size: { type: Number, default: 0 },
    meta: { type: Schema.Types.Mixed },
    favorite: { type: Boolean, default: false, index: true },
    tags: { type: [String], default: [] },
    source: { type: String, enum: ['generated', 'upload'], default: 'generated' },
  },
  { timestamps: true },
);
artifactSchema.index({ ownerId: 1, createdAt: -1 });
artifactSchema.index({ title: 'text', content: 'text' });

export const Artifact = model('Artifact', artifactSchema);
