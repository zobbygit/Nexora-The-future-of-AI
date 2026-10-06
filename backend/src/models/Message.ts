import { Schema, model } from 'mongoose';

const schema = new Schema(
  {
    /** Each user has exactly one conversation with the admin, keyed by the user id. */
    conversationId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sender: { type: String, enum: ['user', 'admin'], required: true },
    text: { type: String, required: true, maxlength: 2000 },
    readAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
schema.index({ conversationId: 1, createdAt: 1 });

export const Message = model('Message', schema);
