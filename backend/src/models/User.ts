import { Schema, model, InferSchemaType, HydratedDocument } from 'mongoose';

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    phone: { type: String, trim: true, maxlength: 20, default: '' },
    passwordHash: { type: String, required: true, select: false },
    recoveryCodeHash: { type: String, select: false },
    avatarUrl: { type: String, default: '' },
    plan: { type: String, enum: ['free', 'pro'], default: 'free', index: true },
    isActive: { type: Boolean, default: true, index: true },
    tokenVersion: { type: Number, default: 0 },
    failedLogins: { type: Number, default: 0 },
    lockUntil: { type: Date },

    credits: { type: Number, default: 0, min: 0 },
    reservedCredits: { type: Number, default: 0, min: 0 },
    creditsResetAt: { type: Date, default: () => new Date(0) },

    stripeCustomerId: { type: String, index: true, sparse: true },

    onboardingCompleted: { type: Boolean, default: false },
    onboarding: {
      useCases: { type: [String], default: [] },
      building: { type: [String], default: [] },
      goals: { type: [String], default: [] },
      completedAt: Date,
    },
    lastActiveAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export type UserAttrs = InferSchemaType<typeof userSchema>;
export type UserDoc = HydratedDocument<UserAttrs>;
export const User = model('User', userSchema);

export const publicUser = (u: any) => ({
  id: String(u._id),
  name: u.name,
  email: u.email,
  phone: u.phone || '',
  avatarUrl: u.avatarUrl || '',
  plan: u.plan,
  isActive: u.isActive,
  credits: u.credits,
  creditsResetAt: u.creditsResetAt,
  onboardingCompleted: !!u.onboardingCompleted,
  onboarding: u.onboarding
    ? { useCases: u.onboarding.useCases || [], building: u.onboarding.building || [], goals: u.onboarding.goals || [] }
    : { useCases: [], building: [], goals: [] },
  createdAt: u.createdAt,
});
