import request from 'supertest';
import { createApp } from '../src/app.js';
import { createUser, authHeader } from './helpers/fixtures.js';
import { isRateLimitDisabled } from '../src/config/security.js';

// Rate limits are skipped in the test environment. These tests switch NODE_ENV
// away from "test" for a moment to prove the limits are still enforced everywhere
// else. They live in their own file because the limiter counters are shared
// within a file.
describe('rate limiting', () => {
  const app = createApp();
  let originalNodeEnv;

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  test('is disabled only for NODE_ENV=test together with a *_test database', () => {
    expect(isRateLimitDisabled()).toBe(true);

    process.env.NODE_ENV = 'production';
    expect(isRateLimitDisabled()).toBe(false);

    process.env.NODE_ENV = 'test';
    const originalDbName = process.env.DB_NAME;
    process.env.DB_NAME = 'uniswap_db';
    expect(isRateLimitDisabled()).toBe(false);
    process.env.DB_NAME = originalDbName;
  });

  test('in test mode many failed logins are not throttled', async () => {
    const statuses = [];
    for (let i = 0; i < 25; i++) {
      const res = await request(app).post('/auth/login').send({ email: 'nobody@test.example', password: 'wrong-password' });
      statuses.push(res.status);
    }
    expect(new Set(statuses)).toEqual(new Set([401]));
  });

  test('outside test mode the auth limiter blocks the 21st attempt within 15 minutes', async () => {
    process.env.NODE_ENV = 'production';
    const statuses = [];
    for (let i = 0; i < 21; i++) {
      const res = await request(app).post('/auth/login').send({ email: 'nobody@test.example', password: 'wrong-password' });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 20).every((s) => s === 401)).toBe(true);
    expect(statuses[20]).toBe(429);
  });

  test('outside test mode the AI limiter blocks the 11th request within a minute', async () => {
    const user = await createUser(app); // created while still in test mode
    process.env.NODE_ENV = 'production';

    const statuses = [];
    for (let i = 0; i < 11; i++) {
      // An invalid body is rejected by validation after the limiter, so OpenAI is never reached
      const res = await request(app).post('/ai/chat').set(authHeader(user.token)).send({});
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 400)).toBe(true);
    expect(statuses[10]).toBe(429);
    expect((await request(app).post('/ai/chat').set(authHeader(user.token)).send({})).body).toEqual({ message: 'Too many AI requests, please slow down.' });
  });
});
