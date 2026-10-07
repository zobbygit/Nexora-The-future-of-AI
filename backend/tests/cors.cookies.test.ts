// Simulates the real production deployment: web on Vercel, API on Render, cookies crossing sites.
process.env.NODE_ENV = 'production';
process.env.JWT_ACCESS_SECRET = 'prod-access-secret-0123456789abcdefghij';
process.env.JWT_REFRESH_SECRET = 'prod-refresh-secret-0123456789abcdefghij';
process.env.ADMIN_EMAIL = 'admin@prod.dev';
process.env.ADMIN_PASSWORD = 'Strong-Prod-Password-9';
process.env.CLIENT_URL = 'https://nexora-app.vercel.app/'; // note the trailing slash people paste into dashboards
process.env.COOKIE_SAMESITE = 'lax';                       // the misconfiguration that caused the 401s
process.env.COOKIE_DOMAIN = '';

jest.mock('../src/models/Setting', () => ({
  Setting: { find: jest.fn(() => ({ lean: async () => [] })), findOne: jest.fn(() => ({ lean: async () => null })), findOneAndUpdate: jest.fn() },
  ErrorLog: { create: jest.fn().mockResolvedValue({}) },
}));
import request from 'supertest';
import { createApp } from '../src/app';

const app = createApp();
const WEB = 'https://nexora-app.vercel.app';
const secure = { 'X-Forwarded-Proto': 'https' };

describe('CORS between Vercel and Render', () => {
  it('allows the Vercel origin even when CLIENT_URL has a trailing slash, with credentials', async () => {
    const res = await request(app).options('/api/auth/login').set(secure).set('Origin', WEB)
      .set('Access-Control-Request-Method', 'POST').set('Access-Control-Request-Headers', 'content-type,x-nexora-client');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(WEB);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.headers['access-control-allow-headers'].toLowerCase()).toContain('x-nexora-client');
    expect(res.headers['access-control-max-age']).toBe('7200'); // preflight cached → fewer round trips
  });
  it('rejects any other site', async () => {
    const res = await request(app).options('/api/auth/login').set(secure).set('Origin', 'https://evil.vercel.app').set('Access-Control-Request-Method', 'POST');
    expect(res.status).toBe(403);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('session cookies across sites', () => {
  it('REGRESSION: COOKIE_SAMESITE=lax without COOKIE_DOMAIN still yields SameSite=None; Secure; HttpOnly', async () => {
    const res = await request(app).post('/api/admin/auth/login').set(secure).set('Origin', WEB).set('X-Nexora-Client', 'web')
      .send({ email: 'admin@prod.dev', password: 'Strong-Prod-Password-9' });
    expect(res.status).toBe(200);
    const cookie = (res.headers['set-cookie'] as unknown as string[]).join(';');
    expect(cookie).toMatch(/nx_admin=/);
    expect(cookie).toMatch(/SameSite=None/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).not.toMatch(/SameSite=Lax/i);
  });
  it('redirects plain-http traffic to https but leaves the Render health check alone', async () => {
    expect((await request(app).get('/api/auth/me').set('Host', 'api.test')).status).toBe(308);
    expect((await request(app).get('/health').set('Host', 'api.test')).status).not.toBe(308);
  });
  it('rejects state-changing requests that lack the custom client header (CSRF defence)', async () => {
    const res = await request(app).post('/api/auth/login').set(secure).set('Origin', WEB).send({ email: 'a@b.co', password: 'x' });
    expect(res.status).toBe(403);
  });
});