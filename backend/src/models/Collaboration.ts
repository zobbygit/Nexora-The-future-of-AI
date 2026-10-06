import { Schema, model } from 'mongoose';

const schema = new Schema(
  {
    artifactId: { type: Schema.Types.ObjectId, ref: 'Artifact', required: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    collaboratorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    permission: { type: String, enum: ['viewer', 'editor'], required: true },
    canDownload: { type: Boolean, default: true },
  },
  { timestamps: true },
);
schema.index({ artifactId: 1, collaboratorId: 1 }, { unique: true });

export const Collaboration = model('Collaboration', schema);
