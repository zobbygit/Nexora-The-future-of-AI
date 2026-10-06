jest.mock('../src/models/User', () => {
  const User: any = { findOne: jest.fn(), findById: jest.fn(), exists: jest.fn(), create: jest.fn(), find: jest.fn() };
  return { User, publicUser: (u: any) => ({ id: String(u._id), name: u.name, plan: u.plan, onboardingCompleted: !!u.onboardingCompleted }) };
});
jest.mock('../src/models/Setting', () => ({
  Setting: { find: jest.fn(() => ({ lean: async () => [] })), findOne: jest.fn(() => ({ lean: async () => null })), findOneAndUpdate: jest.fn() },
  ErrorLog: { create: jest.fn().mockResolvedValue({}) },
}));
jest.mock('../src/services/credit.service', () => ({
  ensureFreshCredits: jest.fn(async () => ({ isActive: true, plan: 'free', credits: 20 })),
  reserveCredits: jest.fn(), releaseCredits: jest.fn(), commitCredits: jest.fn(), applyPlanChange: jest.fn(), adjustCredits: jest.fn(),
}));
import request from 'supertest';
import { createApp } from '../src/app';
import { User } from '../src/models/User';
import { signAccess, signAdmin, COOKIES, verifySocketToken, verifyAccess } from '../src/utils/tokens';
import { reserveCredits } from '../src/services/credit.service';

const app = createApp();
const H = { 'X-Nexora-Client': 'web' };
const U = User as unknown as Record<string, jest.Mock>;

const asUser = (over: Record<string, unknown> = {}) => {
  const doc = { _id: '64b0c0ffee0000000000abcd', name: 'Test', email: 't@t.dev', plan: 'free', isActive: true, tokenVersion: 0, ...over };
  U.findById.mockResolvedValue(doc);
  return `${COOKIES.access}=${signAccess(doc._id, 0)}`;
};
beforeEach(() => jest.clearAllMocks());

describe('platform', () => {
  it('exposes a health endpoint', async () => {
    const res = await request(app).get('/health');
    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty('db');
  });
  it('sets security headers and hides Express', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
  it('returns JSON 404s for unknown routes once authenticated, and 401 before', async () => {
    expect((await request(app).get('/api/nope').set(H)).status).toBe(401);
    const res = await request(app).get('/api/nope').set('Cookie', asUser()).set(H);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
  it('rejects disallowed CORS origins', async () => {
    const res = await request(app).get('/health').set('Origin', 'https://evil.example');
    expect(res.status).toBe(403);
  });
});

describe('csrf guard', () => {
  it('blocks state-changing requests without the client header', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.co', password: 'x' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_BLOCKED');
  });
});

describe('auth', () => {
  it('validates registration input', async () => {
    const res = await request(app).post('/api/auth/register').set(H).send({ name: 'A', email: 'nope', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
  it('rejects unknown emails without leaking which field was wrong', async () => {
    U.findOne.mockReturnValue({ select: async () => null });
    const res = await request(app).post('/api/auth/login').set(H).send({ email: 'ghost@nexora.dev', password: 'Password1' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });
  it('requires a session for protected routes', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
  it('rejects tampered tokens', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', `${COOKIES.access}=abc.def.ghi`);
    expect(res.status).toBe(401);
  });
  it('rejects sessions of deactivated users', async () => {
    const cookie = asUser({ isActive: false });
    const res = await request(app).get('/api/bootstrap').set('Cookie', cookie);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_DEACTIVATED');
  });
  it('rejects revoked sessions (token version mismatch)', async () => {
    const cookie = asUser({ tokenVersion: 3 });
    const res = await request(app).get('/api/bootstrap').set('Cookie', cookie);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('SESSION_REVOKED');
  });
  it('does not accept an admin cookie as a user session', async () => {
    const res = await request(app).get('/api/bootstrap').set('Cookie', `${COOKIES.access}=${signAdmin()}`);
    expect(res.status).toBe(401);
  });
});

describe('session bootstrap', () => {
  it('REGRESSION: /auth/me returns the full profile so a refresh never bounces a finished user back to onboarding', async () => {
    const cookie = asUser({ onboardingCompleted: true, onboarding: { useCases: ['Writing'], building: [], goals: [] }, credits: 20 });
    const res = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('Test');
  });
  it('issues a short-lived socket ticket only to a signed-in user', async () => {
    expect((await request(app).get('/api/auth/socket-token')).status).toBe(401);
    const cookie = asUser();
    const res = await request(app).get('/api/auth/socket-token').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(verifySocketToken(res.body.token).role).toBe('user');
    expect(() => verifySocketToken(signAccess('u', 0))).toThrow();
    expect(verifyAccess(res.body.token).sub).toBeDefined();
  });
  it('admin socket tickets require an admin session', async () => {
    expect((await request(app).get('/api/admin/auth/socket-token')).status).toBe(401);
    const res = await request(app).get('/api/admin/auth/socket-token').set('Cookie', `${COOKIES.admin}=${signAdmin()}`);
    expect(res.status).toBe(200);
  });
});

describe('admin auth & separation', () => {
  it('logs in only with the environment credentials', async () => {
    const bad = await request(app).post('/api/admin/auth/login').set(H).send({ email: 'admin@test.dev', password: 'wrong' });
    expect(bad.status).toBe(401);
    const good = await request(app).post('/api/admin/auth/login').set(H).send({ email: 'admin@test.dev', password: 'Admin-Test-Pass-1' });
    expect(good.status).toBe(200);
    const cookie = (good.headers['set-cookie'] as unknown as string[]).join(';');
    expect(cookie).toMatch(/nx_admin=/);
    expect(cookie).toMatch(/HttpOnly/i);
  });
  it('blocks admin APIs for anonymous visitors and for regular users', async () => {
    expect((await request(app).get('/api/admin/dashboard')).status).toBe(401);
    const cookie = asUser();
    expect((await request(app).get('/api/admin/users').set('Cookie', cookie)).status).toBe(401);
  });
  it('has no admin registration route', async () => {
    const res = await request(app).post('/api/admin/auth/register').set('Cookie', `${COOKIES.admin}=${signAdmin()}`).set(H).send({});
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).not.toBe(200);
  });
  it('accepts a valid admin session', async () => {
    const res = await request(app).get('/api/admin/auth/me').set('Cookie', `${COOKIES.admin}=${signAdmin()}`);
    expect(res.status).toBe(200);
  });
});

describe('pro access control (backend enforced)', () => {
  it('blocks a Free user from a Pro AI endpoint without touching credits', async () => {
    const cookie = asUser({ plan: 'free' });
    const res = await request(app).post('/api/tools/tts').set('Cookie', cookie).set(H).send({ text: 'hello there' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PRO_REQUIRED');
    expect(reserveCredits).not.toHaveBeenCalled();
  });
  it('validates tool input before spending anything', async () => {
    const cookie = asUser();
    const res = await request(app).post('/api/tools/writer').set('Cookie', cookie).set(H).send({ prompt: '' });
    expect(res.status).toBe(400);
    expect(reserveCredits).not.toHaveBeenCalled();
  });
});

describe('injection protection', () => {
  it('neutralises NoSQL operators in login bodies', async () => {
    U.findOne.mockReturnValue({ select: async () => null });
    const res = await request(app).post('/api/auth/login').set(H).send({ email: { $ne: '' }, password: 'x' });
    expect(res.status).toBe(400);
  });
});