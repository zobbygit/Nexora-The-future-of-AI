import { Types } from 'mongoose';
import { Artifact } from '../models/Artifact';
import { Collaboration } from '../models/Collaboration';
import { forbidden, notFound } from '../utils/errors';

export type Access = { artifact: any; role: 'owner' | 'editor' | 'viewer'; canDownload: boolean };

/** Resource ownership + collaboration check used everywhere an artifact is read or changed. */
export const resolveAccess = async (artifactId: string, userId: string): Promise<Access> => {
  if (!Types.ObjectId.isValid(artifactId)) throw notFound('Artifact not found.');
  const artifact = await Artifact.findById(artifactId);
  if (!artifact) throw notFound('Artifact not found.');
  if (String(artifact.ownerId) === userId) return { artifact, role: 'owner', canDownload: true };
  const collab = await Collaboration.findOne({ artifactId, collaboratorId: userId });
  if (!collab) throw notFound('Artifact not found.');
  return { artifact, role: collab.permission, canDownload: collab.permission === 'editor' || collab.canDownload };
};

export const requireRole = (access: Access, needed: 'owner' | 'editor' | 'viewer') => {
  const rank = { viewer: 1, editor: 2, owner: 3 } as const;
  if (rank[access.role] < rank[needed]) throw forbidden(`Only ${needed === 'owner' ? 'the owner' : 'editors'} can do that.`);
};

export const artifactDto = (a: any, role: Access['role'] = 'owner', canDownload = true) => ({
  id: String(a._id),
  title: a.title,
  kind: a.kind,
  tool: a.tool,
  mimeType: a.mimeType,
  content: a.content,
  url: a.url ? String(a.url) : undefined,
  size: a.size,
  meta: a.meta,
  favorite: a.favorite,
  tags: a.tags,
  source: a.source,
  ownerId: String(a.ownerId),
  role,
  canDownload,
  createdAt: a.createdAt,
  updatedAt: a.updatedAt,
});
