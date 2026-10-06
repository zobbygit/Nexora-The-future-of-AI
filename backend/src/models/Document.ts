import { Schema, model } from 'mongoose';

const documentSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    artifactId: { type: Schema.Types.ObjectId, ref: 'Artifact', index: true },
    name: { type: String, required: true },
    pages: Number,
    chunkCount: Number,
    charCount: Number,
    embedder: { type: String, enum: ['huggingface', 'cloudflare', 'local'], required: true },
    embeddingModel: String,
    dims: Number,
    status: { type: String, enum: ['processing', 'ready', 'failed'], default: 'processing' },
    error: String,
  },
  { timestamps: true },
);
export const DocumentModel = model('Document', documentSchema);

const chunkSchema = new Schema({
  documentId: { type: Schema.Types.ObjectId, ref: 'Document', required: true, index: true },
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  index: Number,
  page: Number,
  section: String,
  text: { type: String, required: true },
  embedding: { type: [Number], required: true, select: false },
});
export const DocChunk = model('DocChunk', chunkSchema);