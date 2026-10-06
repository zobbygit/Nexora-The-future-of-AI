jest.mock('../src/models/Artifact', () => ({ Artifact: { findById: jest.fn() } }));
jest.mock('../src/models/Collaboration', () => ({ Collaboration: { findOne: jest.fn(), exists: jest.fn() } }));
jest.mock('../src/models/Document', () => ({ DocumentModel: { findById: jest.fn() }, DocChunk: {} }));
jest.mock('../src/models/Notification', () => ({ Notification: { create: jest.fn(), insertMany: jest.fn() }, NOTIFICATION_TYPES: [] }));
jest.mock('../src/services/providerRouter', () => ({ routeRequest: jest.fn() }));

import { Artifact } from '../src/models/Artifact';
import { Collaboration } from '../src/models/Collaboration';
import { DocumentModel } from '../src/models/Document';
import { Notification } from '../src/models/Notification';
import { requireRole, resolveAccess } from '../src/services/artifact.service';
import { authorizedDocument } from '../src/services/rag.service';
import { notify, notifyMany } from '../src/services/notification.service';
import { checkFile } from '../src/middleware/upload';
import { setIo } from '../src/sockets/io';

const A = Artifact as unknown as { findById: jest.Mock };
const C = Collaboration as unknown as { findOne: jest.Mock; exists: jest.Mock };
const D = DocumentModel as unknown as { findById: jest.Mock };
const ID = '64b0c0ffee0000000000abcd';
beforeEach(() => jest.clearAllMocks());

describe('artifact access control', () => {
  it('owner has full access', async () => {
    A.findById.mockResolvedValue({ _id: ID, ownerId: 'owner1' });
    const a = await resolveAccess(ID, 'owner1');
    expect(a.role).toBe('owner');
  });
  it('a stranger cannot see another user’s private artifact (404, not 403 — no existence leak)', async () => {
    A.findById.mockResolvedValue({ _id: ID, ownerId: 'owner1' });
    C.findOne.mockResolvedValue(null);
    await expect(resolveAccess(ID, 'intruder')).rejects.toMatchObject({ status: 404 });
  });
  it('viewer can read but not edit; download follows the owner’s setting', async () => {
    A.findById.mockResolvedValue({ _id: ID, ownerId: 'owner1' });
    C.findOne.mockResolvedValue({ permission: 'viewer', canDownload: false });
    const a = await resolveAccess(ID, 'viewer1');
    expect(a).toMatchObject({ role: 'viewer', canDownload: false });
    expect(() => requireRole(a, 'editor')).toThrow(/editors/);
    C.findOne.mockResolvedValue({ permission: 'viewer', canDownload: true });
    expect((await resolveAccess(ID, 'viewer1')).canDownload).toBe(true);
  });
  it('editor can edit and always download, but cannot do owner-only actions', async () => {
    A.findById.mockResolvedValue({ _id: ID, ownerId: 'owner1' });
    C.findOne.mockResolvedValue({ permission: 'editor', canDownload: false });
    const a = await resolveAccess(ID, 'editor1');
    expect(a.canDownload).toBe(true);
    expect(() => requireRole(a, 'editor')).not.toThrow();
    expect(() => requireRole(a, 'owner')).toThrow(/owner/);
  });
  it('rejects malformed ids without touching the database', async () => {
    await expect(resolveAccess('not-an-id', 'u')).rejects.toMatchObject({ status: 404 });
    expect(A.findById).not.toHaveBeenCalled();
  });
});

describe('RAG document authorisation', () => {
  it('lets the owner and shared collaborators retrieve, blocks everyone else', async () => {
    D.findById.mockResolvedValue({ _id: ID, ownerId: 'owner1', artifactId: 'art1' });
    await expect(authorizedDocument(ID, 'owner1')).resolves.toBeDefined();
    C.exists.mockResolvedValue({ _id: 'x' });
    await expect(authorizedDocument(ID, 'collab1')).resolves.toBeDefined();
    C.exists.mockResolvedValue(null);
    await expect(authorizedDocument(ID, 'stranger')).rejects.toMatchObject({ status: 404 });
  });
});

describe('notifications', () => {
  it('persists and pushes a real-time event to the user room', async () => {
    const emit = jest.fn();
    setIo({ to: jest.fn(() => ({ emit })) } as any);
    (Notification.create as jest.Mock).mockResolvedValue({ _id: 'n1', createdAt: new Date() });
    await notify('u1', 'collab_invite', 'Shared with you', 'body', '/app/collaboration');
    expect(Notification.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', type: 'collab_invite', title: 'Shared with you' }));
    expect(emit).toHaveBeenCalledWith('notification:new', expect.objectContaining({ id: 'n1', read: false }));
  });
  it('never throws into the request path when persistence fails', async () => {
    (Notification.create as jest.Mock).mockRejectedValue(new Error('db down'));
    await expect(notify('u1', 'system', 'x')).resolves.toBeUndefined();
  });
  it('fans out announcements to every recipient', async () => {
    const emit = jest.fn();
    setIo({ to: jest.fn(() => ({ emit })) } as any);
    (Notification.insertMany as jest.Mock).mockResolvedValue([{ _id: 'a', userId: 'u1', createdAt: new Date() }, { _id: 'b', userId: 'u2', createdAt: new Date() }]);
    expect(await notifyMany(['u1', 'u2'], 'announcement', 'Hi', 'msg')).toBe(2);
    expect(emit).toHaveBeenCalledTimes(2);
    expect(await notifyMany([], 'announcement', 'Hi', 'msg')).toBe(0);
  });
});

describe('upload handling', () => {
  const file = (buf: Buffer, name = 'a.png'): Express.Multer.File => ({ buffer: buf, originalname: name, size: buf.length } as any);
  const png = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.alloc(40)]);
  it('accepts a real PNG and trusts content over the extension', () => {
    expect(checkFile(file(png, 'photo.jpg'), ['image/png']).mime).toBe('image/png');
  });
  it('rejects a script renamed to .png', () => {
    expect(() => checkFile(file(Buffer.from('<?php system($_GET[1]); ?>' + ' '.repeat(40)), 'x.png'), ['image/png'])).toThrow(/not supported/);
  });
  it('rejects the wrong category and missing files', () => {
    expect(() => checkFile(file(png), ['application/pdf'])).toThrow();
    expect(() => checkFile(undefined, ['image/png'], 'image')).toThrow(/Attach/);
  });
  it('sanitises hostile file names', () => {
    expect(checkFile(file(png, '../../etc/pass wd<script>.png'), ['image/png']).filename).not.toMatch(/[<>/\\]/);
  });
});
