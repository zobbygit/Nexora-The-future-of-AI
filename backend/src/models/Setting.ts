import { Schema, model } from 'mongoose';

const schema = new Schema({ key: { type: String, required: true, unique: true }, value: Schema.Types.Mixed }, { timestamps: true });
export const Setting = model('Setting', schema);

const errSchema = new Schema(
  { status: Number, code: String, message: String, path: String, method: String, stack: String },
  { timestamps: { createdAt: 'timestamp', updatedAt: false } },
);
errSchema.index({ timestamp: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });
export const ErrorLog = model('ErrorLog', errSchema);
