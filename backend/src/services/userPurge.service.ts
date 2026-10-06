import { Artifact } from '../models/Artifact';
import { Collaboration } from '../models/Collaboration';
import { CreditTransaction } from '../models/CreditTransaction';
import { DocChunk, DocumentModel } from '../models/Document';
import { Generation } from '../models/Generation';
import { Message } from '../models/Message';
import { Notification } from '../models/Notification';
import { Report } from '../models/Report';
import { User } from '../models/User';
import { deleteFile } from './storage.service';

/** Removes a user and everything they own. Payment records are retained for accounting. */
export const purgeUserData = async (userId: string) => {
  const artifacts = await Artifact.find({ ownerId: userId }).select('storage mimeType').lean();
  await Promise.all(artifacts.map((a) => deleteFile(a.storage as any, a.mimeType || undefined)));
  await Promise.all([
    Artifact.deleteMany({ ownerId: userId }), Generation.deleteMany({ userId }), CreditTransaction.deleteMany({ userId }),
    Notification.deleteMany({ userId }), Report.deleteMany({ userId }), Message.deleteMany({ conversationId: userId }),
    Collaboration.deleteMany({ $or: [{ ownerId: userId }, { collaboratorId: userId }] }),
    DocChunk.deleteMany({ ownerId: userId }), DocumentModel.deleteMany({ ownerId: userId }),
  ]);
  await User.deleteOne({ _id: userId });
};
